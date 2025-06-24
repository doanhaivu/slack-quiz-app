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
    console.log('📁 Processing file_shared event:', eventData.file_id);

    if (!eventData.file_id) {
      console.log('❌ No file_id in file_shared event');
      return;
    }

    // Skip if this is from the bot itself (bot's news audio files)
    const botUserId = process.env.SLACK_BOT_USER_ID || 'U08RV321CB0';
    if (eventData.user_id === botUserId) {
      console.log('🤖 Skipping bot\'s own audio file');
      return;
    }

    const fileInfo = await slack.files.info({
      file: eventData.file_id
    });

    if (!fileInfo.file) {
      console.log('❌ Could not retrieve file information');
      return;
    }

    const file = fileInfo.file;

    // Check if it's an audio file
    const isAudioFile = file.mimetype?.startsWith('audio/') || 
      file.name?.toLowerCase().endsWith('.mp3') ||
      file.name?.toLowerCase().endsWith('.wav') ||
      file.name?.toLowerCase().endsWith('.m4a');

    if (!isAudioFile) {
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
  console.log('🔍 Looking for thread context in channel:', channelId);
  
  try {
    // Try multiple attempts with increasing time windows
    for (let attempt = 1; attempt <= 3; attempt++) {
      const timeWindow = attempt * 60; // 1, 2, 3 minutes
      
      try {
        const recentMessages = await slack.conversations.history({
          channel: channelId,
          limit: 20,
          oldest: (Date.now() / 1000 - timeWindow).toString()
        });

        if (recentMessages.messages && recentMessages.messages.length > 0) {
          // Look for a message with this file
          const messageWithFile = recentMessages.messages.find(msg => 
            msg.files?.some(f => f.id === fileId)
          );

          if (messageWithFile) {
            if (messageWithFile.thread_ts && messageWithFile.user && messageWithFile.ts) {
              console.log('🧵 File posted in thread, processing audio reply...');
              
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
              console.log('❌ File not posted in thread - skipping');
              return; // Not a thread, no need to retry
            }
          }
        }
      } catch (historyError) {
        console.error(`❌ Error fetching channel history (attempt ${attempt}):`, historyError);
        
        // Check if this is a permissions error
        const slackError = historyError as { data?: { error?: string } };
        if (slackError.data?.error === 'missing_scope') {
          console.error('❌ Missing scope error - bot lacks required permissions');
          return; // Don't retry on permissions errors
        }
      }
      
      // If this is not the last attempt, wait before retrying
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
    
    // If we get here, we couldn't find the message after all attempts
    console.log('❌ Could not find message with file after 3 attempts');
    
  } catch (error) {
    console.error('❌ Error checking for thread context:', error);
  }
} 