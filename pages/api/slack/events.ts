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
    
    // Handle message events with files (audio replies)
    if (event.type === 'event_callback' && 
        event.event.type === 'message' && 
        event.event.files && 
        event.event.files.length > 0) {
      
      // Check if this is a thread reply
      if (event.event.thread_ts) {
        await handleAudioReply(event.event);
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

    const slackClient = getSlackClientForBot(); // Use default bot for event handling
    
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
  const slackClient = getSlackClientForBot(); // Use default bot for event handling
  
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

async function handleAudioReply(eventData: SlackEvent['event']) {
  try {
    // Find audio files in the message
    const audioFiles = eventData.files?.filter(file => 
      file.mimetype.startsWith('audio/') || 
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.wav') ||
      file.name.toLowerCase().endsWith('.m4a')
    );

    if (!audioFiles || audioFiles.length === 0) {
      return;
    }

    console.log(`📞 Audio reply detected with ${audioFiles.length} audio file(s)`);

    // Get the original message to extract the news piece text
    const parentMessage = await slack.conversations.replies({
      channel: eventData.channel,
      ts: eventData.thread_ts!,
      limit: 1
    });

    if (!parentMessage.messages || parentMessage.messages.length === 0) {
      console.error('Could not find parent message');
      return;
    }

    // Extract the news piece text from the parent message
    const originalText = extractNewsTextFromMessage(parentMessage.messages[0]);
    
    if (!originalText) {
      console.error('Could not extract news text from parent message');
      return;
    }

    // Process the first audio file
    const audioFile = audioFiles[0];
    await processAudioFile(audioFile, originalText, eventData);

  } catch (error) {
    console.error('Error handling audio reply:', error);
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

    // Download the audio file from Slack
    const response = await axios.get(audioFile.url_private_download, {
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
      },
      responseType: 'arraybuffer'
    });

    const audioBuffer = Buffer.from(response.data);

    // Create a File object for OpenAI API
    const file = new File([audioBuffer], audioFile.name, {
      type: audioFile.mimetype,
    });

    // Convert audio to text using OpenAI's Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    console.log(`📝 Transcription: ${transcription.text}`);

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

    console.log('✅ Feedback posted to Slack thread');

  } catch (error) {
    console.error('Error processing audio file:', error);
    
    // Post error message to user
    await slack.chat.postMessage({
      channel: eventData.channel,
      thread_ts: eventData.thread_ts,
      text: `❌ Sorry <@${eventData.user}>, I couldn't process your audio recording. Please try again.`
    });
  }
} 