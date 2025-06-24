/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
import axios from 'axios';
import { getSlackClientForBot } from '../../../services/slack/client';
import { lunchOrders } from '../lunch/schedule';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SlackEvent {
  type: string;
  event: {
    type: string;
    channel: string;
    user: string;
    text: string;
    files?: Array<{
      id: string;
      name: string;
      mimetype: string;
      url_private: string;
      url_private_download: string;
    }>;
    thread_ts?: string;
    ts: string;
    reaction?: string; // For reaction events
    item?: {
      type: string;
      channel: string;
      ts: string;
    };
  };
  team_id: string;
  event_id: string;
  event_time: number;
}

interface SlackReactionEvent {
  type: string;
  user: string;
  reaction: string;
  item: {
    type: string;
    channel: string;
    ts: string;
  };
}

interface LunchOrderData {
  messageTs?: string;
  date: string;
  channelId: string;
  botId: string; // Store which bot was used to post this message
  orders: {
    userId: string;
    username: string;
    timestamp: string;
  }[];
  scheduledTime: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle Slack URL verification challenge
  if (req.body.challenge) {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  try {
    const event: SlackEvent = req.body;
    
    console.log('📨 Received Slack event:', {
      type: event.type,
      eventType: event.event?.type,
      hasFiles: !!event.event?.files,
      fileCount: event.event?.files?.length || 0,
      isThreadReply: !!event.event?.thread_ts,
      channel: event.event?.channel,
      user: event.event?.user,
      fullEvent: JSON.stringify(event, null, 2)
    });
    
    // Handle message events with files (audio replies)
    if (event.type === 'event_callback' && event.event.type === 'message') {
      console.log('💬 Message event received:', {
        hasFiles: !!event.event.files,
        fileCount: event.event.files?.length || 0,
        hasThread: !!event.event.thread_ts,
        user: event.event.user,
        text: event.event.text?.substring(0, 100),
        subtype: (event.event as any).subtype
      });

      if (event.event.files && event.event.files.length > 0) {
        console.log('📎 Message with files detected:', event.event.files.map(f => ({
          name: f.name,
          mimetype: f.mimetype,
          id: f.id
        })));
        
        // Check if this is a thread reply
        if (event.event.thread_ts) {
          console.log('🧵 Processing thread reply via message event...');
          await handleAudioReply(event.event);
        } else {
          console.log('❌ Not a thread reply - audio processing skipped');
        }
      }
    }

    // Handle file_shared events (when audio files are uploaded)
    if (event.type === 'event_callback' && event.event.type === 'file_shared') {
      console.log('📁 File shared event detected');
      try {
        await handleFileShared(event.event as any);
      } catch (error) {
        console.error('❌ Error handling file_shared event:', error);
      }
    }

    // Handle reaction events for lunch orders
    if (event.type === 'event_callback' && 
        (event.event.type === 'reaction_added' || event.event.type === 'reaction_removed')) {
      
      // Handle checkmark and cross reactions for lunch orders
      if (event.event.reaction === 'white_check_mark' || event.event.reaction === 'x') {
        try {
          await handleLunchReaction(event.event as SlackReactionEvent);
        } catch (error) {
          console.error('Error handling lunch reaction:', error);
        }
      }
    }

    // Log any unhandled events for debugging
    if (event.type === 'event_callback' && !['message', 'file_shared', 'reaction_added', 'reaction_removed'].includes(event.event.type)) {
      console.log('🔍 Unhandled event type:', event.event.type, 'Full event:', JSON.stringify(event, null, 2));
    }

    return res.status(200).json({ message: 'Event processed' });
  } catch (error) {
    console.error('Error handling Slack event:', error);
    return res.status(500).json({ error: 'Failed to process event' });
  }
}

async function handleLunchReaction(event: SlackReactionEvent) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todaysOrders = lunchOrders.get(today);

    if (!todaysOrders || todaysOrders.messageTs !== event.item.ts) {
      // This reaction is not for today's lunch message
      return;
    }

    const slackClient = getSlackClientForBot(todaysOrders.botId); // Use same bot that posted the message
    
    console.log(`🔄 Handling lunch reaction - Using bot: ${todaysOrders.botId}, Channel: ${event.item.channel}`);
    
    // Get all reactions on the message to determine user's actual status
    const messageReactions = await slackClient.reactions.get({
      channel: event.item.channel,
      timestamp: event.item.ts
    });

    // Get user info
    const userInfo = await slackClient.users.info({ user: event.user });
    const username = userInfo.user?.real_name || userInfo.user?.name || 'Unknown User';

    // Check if user has both checkmark and cross reactions
    const reactions = messageReactions.message?.reactions || [];
    const userHasCheckmark = reactions.find((r: any) => r.name === 'white_check_mark')?.users?.includes(event.user) || false;
    const userHasCross = reactions.find((r: any) => r.name === 'x')?.users?.includes(event.user) || false;

    // Determine if user should be in orders list
    // If user has both reactions, cross takes priority (they don't want to order)
    const shouldOrder = userHasCheckmark && !userHasCross;

    const existingOrderIndex = todaysOrders.orders.findIndex(order => order.userId === event.user);

    if (shouldOrder) {
      // Add user to orders if not already present
      if (existingOrderIndex === -1) {
        todaysOrders.orders.push({
          userId: event.user,
          username: username,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Remove user from orders if present
      if (existingOrderIndex !== -1) {
        todaysOrders.orders = todaysOrders.orders.filter(order => order.userId !== event.user);
      }
    }

    // Update the message with new order list
    await updateLunchMessage(event.item.channel, todaysOrders);

  } catch (error) {
    console.error('Error handling lunch reaction:', error);
  }
}

async function updateLunchMessage(channelId: string, orderData: LunchOrderData) {
  const slackClient = getSlackClientForBot(orderData.botId); // Use same bot that posted the message
  
  console.log(`📝 Updating lunch message - Bot: ${orderData.botId}, Channel: ${channelId}, Orders: ${orderData.orders.length}`);
  
  const ordersList = orderData.orders.length > 0 
    ? orderData.orders.map((order) => `• ${order.username}`).join('\n')
    : '_No orders yet..._';

  const totalOrders = orderData.orders.length;
  const deadline = orderData.scheduledTime === "09:30" ? "10:30 AM" : "11:30 AM";

  try {
    if (!orderData.messageTs) {
      console.error('No messageTs found for order data');
      return;
    }

    await slackClient.chat.update({
      channel: channelId,
      ts: orderData.messageTs,
      text: "🍽️ Daily Lunch Order - React with ✅ to order or ❌ for no order!",
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🍽️ Daily Lunch Order'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📅 *${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}*\n\n✅ React with :white_check_mark: to order lunch!\n❌ React with :x: if you're not ordering\n\n*Orders so far (${totalOrders}):*\n${ordersList}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⏰ Deadline: ${deadline} | 📊 Total orders: ${totalOrders}`
            }
          ]
        }
      ]
    });

    console.log(`✅ Updated lunch message: ${totalOrders} orders`);
  } catch (error) {
    console.error('Error updating lunch message:', error);
  }
}

async function handleFileShared(eventData: any) {
  try {
    console.log('📁 handleFileShared called with event:', JSON.stringify(eventData, null, 2));

    // Get file information using the file_id
    if (!eventData.file_id) {
      console.log('❌ No file_id in file_shared event');
      return;
    }

    // Skip if this is from the bot itself (bot's news audio files)
    const botUserId = process.env.SLACK_BOT_USER_ID || 'U08RV321CB0'; // Add your bot's user ID here
    if (eventData.user_id === botUserId) {
      console.log('🤖 Skipping bot\'s own audio file (news audio)');
      return;
    }

    console.log('🔍 Getting file info for:', eventData.file_id);
    const fileInfo = await slack.files.info({
      file: eventData.file_id
    });

    if (!fileInfo.file) {
      console.log('❌ Could not retrieve file information');
      return;
    }

    const file = fileInfo.file;
    console.log('📄 File details:', {
      name: file.name,
      mimetype: file.mimetype,
      channels: file.channels,
      shares: file.shares,
      created: file.created,
      timestamp: file.timestamp
    });

    // Check if it's an audio file
    const isAudioFile = file.mimetype?.startsWith('audio/') || 
      file.name?.toLowerCase().endsWith('.mp3') ||
      file.name?.toLowerCase().endsWith('.wav') ||
      file.name?.toLowerCase().endsWith('.m4a');

    if (!isAudioFile) {
      console.log('❌ Not an audio file, skipping');
      return;
    }

    console.log('🎵 Audio file detected in file_shared event');

    // Get the channel from shares
    let channelId = eventData.channel_id;
    if (!channelId && file.shares) {
      // Extract channel from shares
      if (file.shares.private) {
        channelId = Object.keys(file.shares.private)[0];
      } else if (file.shares.public) {
        channelId = Object.keys(file.shares.public)[0];
      }
    }

    if (!channelId) {
      console.log('❌ Could not determine channel for file');
      return;
    }

    console.log('🔍 Checking recent messages in channel for thread context...');
    console.log('🔍 Channel ID:', channelId);
    console.log('🔍 Bot token (first 20 chars):', process.env.SLACK_BOT_TOKEN?.substring(0, 20));
    
    // First, try to get channel info to understand what type of channel this is
    try {
      const channelInfo = await slack.conversations.info({
        channel: channelId
      });
      console.log('📊 Channel info:', {
        name: channelInfo.channel?.name,
        is_private: channelInfo.channel?.is_private,
        is_group: channelInfo.channel?.is_group,
        is_channel: channelInfo.channel?.is_channel,
        is_im: channelInfo.channel?.is_im
      });
    } catch (infoError) {
      console.error('❌ Could not get channel info:', infoError);
    }
    
    // Look for recent messages in the channel to see if this file was posted in a thread
    try {
      const recentMessages = await slack.conversations.history({
        channel: channelId,
        limit: 10,
        oldest: (Date.now() / 1000 - 60).toString() // Last minute
      });

      console.log(`📬 Found ${recentMessages.messages?.length || 0} recent messages`);

      // Look for a message with this file
      const messageWithFile = recentMessages.messages?.find(msg => 
        msg.files?.some(f => f.id === eventData.file_id)
      );

      if (messageWithFile) {
        console.log('📨 Found message with our file:', {
          hasThread: !!messageWithFile.thread_ts,
          threadTs: messageWithFile.thread_ts,
          user: messageWithFile.user,
          ts: messageWithFile.ts
        });

        if (messageWithFile.thread_ts && messageWithFile.user && messageWithFile.ts) {
          console.log('🧵 File was posted in a thread! Processing audio reply...');
          
          // Create a mock event data structure for the existing handleAudioReply function
          const mockEventData = {
            type: 'message',
            channel: channelId,
            user: messageWithFile.user,
            text: messageWithFile.text || '',
            files: messageWithFile.files?.filter(f => f.id && f.name && f.mimetype && f.url_private && f.url_private_download).map(f => ({
              id: f.id!,
              name: f.name!,
              mimetype: f.mimetype!,
              url_private: f.url_private!,
              url_private_download: f.url_private_download!
            })),
            thread_ts: messageWithFile.thread_ts,
            ts: messageWithFile.ts
          };

          await handleAudioReply(mockEventData);
        } else {
          console.log('❌ File was not posted in a thread - audio processing requires thread replies');
        }
      } else {
        console.log('🔍 No message found with this file yet - trying with delay...');
        
        // Wait 2 seconds and try again (message might not be posted yet)
        setTimeout(async () => {
          try {
            console.log('🔄 Retrying after delay...');
            const retryMessages = await slack.conversations.history({
              channel: channelId,
              limit: 10,
              oldest: (Date.now() / 1000 - 120).toString() // Last 2 minutes
            });

            const retryMessageWithFile = retryMessages.messages?.find(msg => 
              msg.files?.some(f => f.id === eventData.file_id)
            );

            if (retryMessageWithFile && retryMessageWithFile.thread_ts && retryMessageWithFile.user && retryMessageWithFile.ts) {
              console.log('🧵 Found message with file after retry! Processing audio reply...');
              
              const mockEventData = {
                type: 'message',
                channel: channelId,
                user: retryMessageWithFile.user,
                text: retryMessageWithFile.text || '',
                files: retryMessageWithFile.files?.filter(f => f.id && f.name && f.mimetype && f.url_private && f.url_private_download).map(f => ({
                  id: f.id!,
                  name: f.name!,
                  mimetype: f.mimetype!,
                  url_private: f.url_private!,
                  url_private_download: f.url_private_download!
                })),
                thread_ts: retryMessageWithFile.thread_ts,
                ts: retryMessageWithFile.ts
              };

              await handleAudioReply(mockEventData);
            } else {
              console.log('❌ Still no message found after retry - audio file might not be in a thread');
            }
          } catch (retryError) {
            console.error('❌ Error in retry attempt:', retryError);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Error checking for thread context:', error);
      
      const slackError = error as any;
      console.error('❌ Full error details:', {
        code: slackError.code,
        message: slackError.message,
        data: slackError.data,
        response: slackError.response?.data
      });
      
      if (slackError.code === 'slack_webapi_platform_error') {
        if (slackError.data?.error === 'missing_scope') {
          console.error('❌ MISSING SCOPE ERROR DETAILS:', slackError.data);
          console.error('❌ This might be a private channel - you may need "groups:history" scope for private channels');
          
          // Post an error message to the channel
          try {
            await slack.chat.postMessage({
              channel: channelId,
              text: `❌ *Audio Processing Setup Issue*\n\nI detected an audio file but can't read channel history.\n\n**Possible causes:**\n• Missing \`channels:history\` scope (for public channels)\n• Missing \`groups:history\` scope (for private channels)\n• Bot token issue\n\n**Required scopes for audio processing:**\n• \`channels:history\` - Read messages in public channels\n• \`groups:history\` - Read messages in private channels\n• \`files:read\` - Access uploaded files\n• \`chat:write\` - Post messages\n\nChannel ID: \`${channelId}\``,
              thread_ts: undefined
            });
          } catch (postError) {
            console.error('❌ Failed to post error message:', postError);
          }
        } else {
          console.error('❌ OTHER SLACK API ERROR:', slackError.data?.error);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in handleFileShared:', error);
  }
}

async function handleAudioReply(eventData: SlackEvent['event']) {
  try {
    console.log('🎵 handleAudioReply called with files:', eventData.files?.map(f => ({
      name: f.name,
      mimetype: f.mimetype
    })));

    // Find audio files in the message
    const audioFiles = eventData.files?.filter(file => 
      file.mimetype.startsWith('audio/') || 
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.wav') ||
      file.name.toLowerCase().endsWith('.m4a')
    );

    console.log('🔍 Audio files found:', audioFiles?.length || 0);

    if (!audioFiles || audioFiles.length === 0) {
      console.log('❌ No audio files found in message');
      return;
    }

    console.log(`📞 Audio reply detected with ${audioFiles.length} audio file(s)`);

    // Get the original message to extract the news piece text
    console.log('📋 Fetching parent message with thread_ts:', eventData.thread_ts);
    const parentMessage = await slack.conversations.replies({
      channel: eventData.channel,
      ts: eventData.thread_ts!,
      limit: 1
    });

    console.log('📋 Parent message result:', {
      messageCount: parentMessage.messages?.length || 0,
      hasBlocks: !!parentMessage.messages?.[0]?.blocks,
      hasText: !!parentMessage.messages?.[0]?.text
    });

    if (!parentMessage.messages || parentMessage.messages.length === 0) {
      console.error('❌ Could not find parent message');
      return;
    }

    // Extract the news piece text from the parent message
    const originalText = extractNewsTextFromMessage(parentMessage.messages[0]);
    
    console.log('📝 Extracted text length:', originalText?.length || 0);
    console.log('📝 Extracted text preview:', originalText?.substring(0, 200));
    
    if (!originalText) {
      console.error('❌ Could not extract news text from parent message');
      return;
    }

    // Process the first audio file
    const audioFile = audioFiles[0];
    console.log('🎧 Processing audio file:', audioFile.name);
    await processAudioFile(audioFile, originalText, eventData);

  } catch (error) {
    console.error('❌ Error handling audio reply:', error);
  }
}

function extractNewsTextFromMessage(message: any): string | null {
  try {
    // Extract text from Slack message blocks
    if (message.blocks) {
      for (const block of message.blocks) {
        if (block.type === 'section' && block.text) {
          // Remove markdown formatting and emoji, extract the main content
          let text = block.text.text || '';
          // Remove the title/heading (usually has emoji and is bold)
          const lines = text.split('\n');
          if (lines.length > 1) {
            // Skip the first line (title) and take the rest
            text = lines.slice(1).join('\n').trim();
            // Remove "Read more" links
            text = text.replace(/\n<[^>]+\|Read more>/, '');
            return text;
          }
        }
      }
    }
    
    // Fallback to plain text
    if (message.text) {
      return message.text;
    }

    return null;
  } catch (error) {
    console.error('Error extracting news text:', error);
    return null;
  }
}

async function processAudioFile(
  audioFile: any,
  originalText: string,
  eventData: SlackEvent['event']
) {
  try {
    console.log(`🎵 Processing audio file: ${audioFile.name}`);
    console.log(`📁 File details:`, {
      name: audioFile.name,
      mimetype: audioFile.mimetype,
      url: audioFile.url_private_download ? 'present' : 'missing'
    });

    // Download the audio file from Slack
    console.log('⬇️ Downloading audio file from Slack...');
    const response = await axios.get(audioFile.url_private_download, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
      },
      responseType: 'arraybuffer'
    });

    console.log(`📊 Downloaded ${response.data.byteLength} bytes`);
    const audioBuffer = Buffer.from(response.data);

    // Create a File object for OpenAI API
    const file = new File([audioBuffer], audioFile.name, {
      type: audioFile.mimetype,
    });

    console.log('🗣️ Sending to OpenAI Whisper for transcription...');
    // Convert audio to text using OpenAI's Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    console.log(`📝 Transcription completed: ${transcription.text}`);

    console.log('🤖 Generating feedback with GPT-4...');
    // Use GPT to compare and provide feedback
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert language teacher. Compare the student's pronunciation with the original text and provide a score from 0-100 based on accuracy, fluency, and pronunciation. Also provide specific feedback on what was good and what needs improvement. Keep your response concise but helpful."
        },
        {
          role: "user",
          content: `Original text: "${originalText}"\n\nStudent's pronunciation: "${transcription.text}"\n\nPlease provide a score and detailed feedback.`
        }
      ],
    });

    const feedback = completion.choices[0].message.content;
    console.log('📈 Feedback generated, posting to Slack...');

    // Post feedback as a reply in the thread
    await slack.chat.postMessage({
      channel: eventData.channel,
      thread_ts: eventData.thread_ts,
      text: `🎤 *Pronunciation Feedback for <@${eventData.user}>*\n\n📝 *What you said:* "${transcription.text}"\n\n${feedback}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎤 *Pronunciation Feedback for <@${eventData.user}>*`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📝 *What you said:*\n"${transcription.text}"`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📊 *Feedback:*\n${feedback}`
          }
        }
      ]
    });

    console.log('✅ Feedback posted to Slack thread successfully');

  } catch (error) {
    console.error('❌ Error processing audio file:', error);
    const errorObj = error as Error;
    console.error('❌ Error details:', {
      message: errorObj.message,
      stack: errorObj.stack,
      name: errorObj.name
    });
    
    // Post error message to user
    try {
      await slack.chat.postMessage({
        channel: eventData.channel,
        thread_ts: eventData.thread_ts,
        text: `❌ Sorry <@${eventData.user}>, I couldn't process your audio recording. Please try again.`
      });
    } catch (slackError) {
      console.error('❌ Failed to post error message to Slack:', slackError);
    }
  }
} 