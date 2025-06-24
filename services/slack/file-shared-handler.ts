import { WebClient } from '@slack/web-api';
import { handleAudioReply } from './audio-handler';

interface SlackFileSharedEvent {
  file_id: string;
  user_id: string;
  channel_id?: string;
}

interface SlackEventData {
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
}

export async function handleFileShared(eventData: SlackFileSharedEvent, slack: WebClient): Promise<void> {
  try {
    console.log('📁 handleFileShared called with event:', JSON.stringify(eventData, null, 2));

    // Get file information using the file_id
    if (!eventData.file_id) {
      console.log('❌ No file_id in file_shared event');
      return;
    }

    // Skip if this is from the bot itself (bot's news audio files)
    const botUserId = process.env.SLACK_BOT_USER_ID || 'U08RV321CB0';
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

    await processFileInThread(eventData.file_id, channelId, slack);

  } catch (error) {
    console.error('❌ Error in handleFileShared:', error);
  }
}

async function processFileInThread(fileId: string, channelId: string, slack: WebClient): Promise<void> {
  console.log('🔍 Checking recent messages in channel for thread context...');
  console.log('🔍 Channel ID:', channelId);
  
  // First, try to get channel info to understand what type of channel this is
  let channelInfo;
  try {
    const channelInfoResponse = await slack.conversations.info({
      channel: channelId
    });
    channelInfo = channelInfoResponse.channel;
    console.log('📊 Channel info:', {
      name: channelInfo?.name,
      is_private: channelInfo?.is_private,
      is_group: channelInfo?.is_group,
      is_channel: channelInfo?.is_channel,
      is_im: channelInfo?.is_im
    });
  } catch (infoError) {
    console.error('❌ Could not get channel info:', infoError);
  }
  
  // Check if bot is in the channel
  try {
    console.log('👥 Checking if bot is member of channel...');
    const members = await slack.conversations.members({
      channel: channelId
    });
    const botUserId = process.env.SLACK_BOT_USER_ID || 'U08RV321CB0';
    const isBotMember = members.members?.includes(botUserId);
    console.log('🤖 Bot membership:', {
      botUserId,
      isMember: isBotMember,
      totalMembers: members.members?.length || 0
    });
  } catch (memberError) {
    console.error('❌ Could not check channel membership:', memberError);
  }
  
  // Look for recent messages in the channel to see if this file was posted in a thread
  try {
    // Try multiple attempts with increasing time windows
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔄 Attempt ${attempt}/3 to find message with file...`);
      
      const timeWindow = attempt * 60; // 1, 2, 3 minutes
      
      try {
        const recentMessages = await slack.conversations.history({
          channel: channelId,
          limit: 20, // Increased from 10
          oldest: (Date.now() / 1000 - timeWindow).toString()
        });

        console.log(`📬 Found ${recentMessages.messages?.length || 0} recent messages (${timeWindow}s window)`);

        // If we found messages, look for the file
        if (recentMessages.messages && recentMessages.messages.length > 0) {
          // Log some message details for debugging
          console.log('📋 Recent message details:', recentMessages.messages.slice(0, 3).map(msg => ({
            ts: msg.ts,
            user: msg.user,
            hasFiles: !!msg.files,
            fileCount: msg.files?.length || 0,
            fileIds: msg.files?.map(f => f.id) || [],
            thread_ts: msg.thread_ts,
            subtype: (msg as { subtype?: string }).subtype
          })));
          
          // Look for a message with this file
          const messageWithFile = recentMessages.messages.find(msg => 
            msg.files?.some(f => f.id === fileId)
          );

          if (messageWithFile) {
            console.log('📨 Found message with our file:', {
              hasThread: !!messageWithFile.thread_ts,
              threadTs: messageWithFile.thread_ts,
              user: messageWithFile.user,
              ts: messageWithFile.ts,
              subtype: (messageWithFile as { subtype?: string }).subtype
            });

            if (messageWithFile.thread_ts && messageWithFile.user && messageWithFile.ts) {
              console.log('🧵 File was posted in a thread! Processing audio reply...');
              
              // Create a mock event data structure for the existing handleAudioReply function
              const mockEventData: SlackEventData = {
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

              await handleAudioReply(mockEventData, slack);
              return; // Success, exit the function
            } else {
              console.log('❌ File was not posted in a thread - audio processing requires thread replies');
              await postHelpMessage(channelId, 'not_thread', slack);
              return; // Not a thread, no need to retry
            }
          }
        } else {
          console.log(`❌ No messages found in ${timeWindow}s window - this suggests a permissions issue`);
        }
      } catch (historyError) {
        console.error(`❌ Error fetching channel history (attempt ${attempt}):`, historyError);
        
        // Check if this is a permissions error
        const slackError = historyError as { data?: { error?: string } };
        if (slackError.data?.error === 'missing_scope') {
          console.error('❌ MISSING SCOPE ERROR - Bot lacks required permissions');
          await postPermissionsError(channelId, channelInfo, slack);
          return; // Don't retry on permissions errors
        }
      }
      
      // If this is not the last attempt, wait before retrying
      if (attempt < 3) {
        console.log(`⏳ Waiting ${attempt * 2} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
    
    // If we get here, we couldn't find the message after all attempts
    console.log('❌ Could not find message with file after 3 attempts');
    console.log('🔍 This could be due to:');
    console.log('   1. Permissions issue - bot cannot read channel history');
    console.log('   2. Audio file was not posted in a thread');
    console.log('   3. Message event timing issue');
    
    await postHelpMessage(channelId, 'not_found', slack);
    
  } catch (error) {
    await handleSlackError(error, channelId, slack);
  }
}

async function postPermissionsError(channelId: string, channelInfo: { name?: string; is_private?: boolean } | undefined, slack: WebClient): Promise<void> {
  const channelType = channelInfo?.is_private ? 'private' : 'public';
  const requiredScope = channelInfo?.is_private ? 'groups:history' : 'channels:history';
  
  try {
    await slack.chat.postMessage({
      channel: channelId,
      text: `🚨 *Audio Processing Setup Issue*\n\nI can't read message history in this ${channelType} channel.\n\n**Fix needed:**\n• Add \`${requiredScope}\` scope to the bot\n• Reinstall/reauthorize the bot with updated permissions\n\n**Current issue:** Missing \`${requiredScope}\` permission\n**Channel:** ${channelInfo?.name || channelId} (${channelType})`
    });
  } catch (postError) {
    console.error('❌ Failed to post permissions error message:', postError);
  }
}

async function postHelpMessage(channelId: string, reason: 'not_thread' | 'not_found', slack: WebClient): Promise<void> {
  try {
    let message = '';
    if (reason === 'not_thread') {
      message = `ℹ️ *Audio files detected*\n\nI can process audio files, but only when they're posted as **replies in a thread**.\n\n**How to use:**\n1. Find a news post with audio\n2. Click "Reply in thread"\n3. Record and send your audio reply\n4. I'll compare your pronunciation and give feedback!`;
    } else {
      message = `⚠️ *Audio file uploaded but not processed*\n\nI detected an audio file but couldn't process it.\n\n**Possible reasons:**\n• File not posted as thread reply\n• Bot permissions issue\n• Timing issue\n\n**To use audio feedback:**\n1. Reply to a news post in a thread\n2. Record your audio response\n3. I'll analyze your pronunciation!`;
    }
    
    await slack.chat.postMessage({
      channel: channelId,
      text: message
    });
  } catch (postError) {
    console.error('❌ Failed to post help message:', postError);
  }
}

async function handleSlackError(error: unknown, channelId: string, slack: WebClient): Promise<void> {
  console.error('❌ Error checking for thread context:', error);
  
  const slackError = error as { code?: string; data?: { error?: string }; message?: string; response?: { data?: unknown } };
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