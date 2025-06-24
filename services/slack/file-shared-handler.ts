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
      msg.files?.some(f => f.id === fileId)
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
      } else {
        console.log('❌ File was not posted in a thread - audio processing requires thread replies');
      }
    } else {
      console.log('🔍 No message found with this file yet - trying with delay...');
      
      // Wait 2 seconds and try again (message might not be posted yet)
      setTimeout(async () => {
        try {
          console.log('🔄 Retrying after delay...');
          await retryProcessFile(fileId, channelId, slack);
        } catch (retryError) {
          console.error('❌ Error in retry attempt:', retryError);
        }
      }, 2000);
    }
  } catch (error) {
    await handleSlackError(error, channelId, slack);
  }
}

async function retryProcessFile(fileId: string, channelId: string, slack: WebClient): Promise<void> {
  const retryMessages = await slack.conversations.history({
    channel: channelId,
    limit: 10,
    oldest: (Date.now() / 1000 - 120).toString() // Last 2 minutes
  });

  const retryMessageWithFile = retryMessages.messages?.find(msg => 
    msg.files?.some(f => f.id === fileId)
  );

  if (retryMessageWithFile && retryMessageWithFile.thread_ts && retryMessageWithFile.user && retryMessageWithFile.ts) {
    console.log('🧵 Found message with file after retry! Processing audio reply...');
    
    const mockEventData: SlackEventData = {
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

    await handleAudioReply(mockEventData, slack);
  } else {
    console.log('❌ Still no message found after retry - audio file might not be in a thread');
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