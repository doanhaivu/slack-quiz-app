/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import { handleLunchReaction } from '../../../services/slack/lunch-handler';
import { handleAudioReply } from '../../../services/slack/audio-handler';
import { handleFileShared } from '../../../services/slack/file-shared-handler';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

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
    reaction?: string;
    item?: {
      type: string;
      channel: string;
      ts: string;
    };
    file_id?: string;
    user_id?: string;
    channel_id?: string;
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
      subtype: (event.event as any).subtype,
      fullEvent: JSON.stringify(event, null, 2)
    });
    
    // Handle message events with files (audio replies) - be more comprehensive
    if (event.type === 'event_callback' && event.event.type === 'message') {
      const messageEvent = event.event as any;
      
      console.log('💬 Message event received:', {
        hasFiles: !!messageEvent.files,
        fileCount: messageEvent.files?.length || 0,
        hasThread: !!messageEvent.thread_ts,
        user: messageEvent.user,
        text: messageEvent.text?.substring(0, 100),
        subtype: messageEvent.subtype,
        botId: messageEvent.bot_id,
        upload: messageEvent.upload
      });

      // Process messages with files, but exclude bot messages and certain subtypes
      if (messageEvent.files && 
          messageEvent.files.length > 0 && 
          !messageEvent.bot_id && 
          messageEvent.subtype !== 'bot_message') {
        
        console.log('📎 Message with files detected:', messageEvent.files.map((f: any) => ({
          name: f.name,
          mimetype: f.mimetype,
          id: f.id
        })));
        
        // Check if this is a thread reply (for audio processing)
        if (messageEvent.thread_ts) {
          console.log('🧵 Processing thread reply via message event...');
          
          // Check if any files are audio files
          const audioFiles = messageEvent.files.filter((file: any) => 
            file.mimetype?.startsWith('audio/') || 
            file.name?.toLowerCase().endsWith('.mp3') ||
            file.name?.toLowerCase().endsWith('.wav') ||
            file.name?.toLowerCase().endsWith('.m4a')
          );
          
          if (audioFiles.length > 0) {
            console.log(`🎵 Found ${audioFiles.length} audio file(s) in thread reply`);
            
            const eventData: SlackEventData = {
              type: messageEvent.type,
              channel: messageEvent.channel,
              user: messageEvent.user,
              text: messageEvent.text || '',
              files: messageEvent.files.filter((f: any) => f.id && f.name && f.mimetype && f.url_private && f.url_private_download).map((f: any) => ({
                id: f.id,
                name: f.name,
                mimetype: f.mimetype,
                url_private: f.url_private,
                url_private_download: f.url_private_download
              })),
              thread_ts: messageEvent.thread_ts,
              ts: messageEvent.ts
            };
            await handleAudioReply(eventData, slack);
          } else {
            console.log('❌ No audio files found in thread reply');
          }
        } else {
          console.log('❌ Not a thread reply - audio processing skipped');
        }
      } else {
        if (messageEvent.bot_id) {
          console.log('🤖 Skipping bot message');
        } else if (messageEvent.subtype === 'bot_message') {
          console.log('🤖 Skipping bot_message subtype');
        } else if (!messageEvent.files || messageEvent.files.length === 0) {
          console.log('📝 Message without files');
        }
      }
    }

    // Handle file_shared events (when audio files are uploaded) - keep as fallback
    if (event.type === 'event_callback' && event.event.type === 'file_shared') {
      console.log('📁 File shared event detected');
      try {
        const fileSharedEvent: SlackFileSharedEvent = {
          file_id: event.event.file_id!,
          user_id: event.event.user_id!,
          channel_id: event.event.channel_id
        };
        await handleFileShared(fileSharedEvent, slack);
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