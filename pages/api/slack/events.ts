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
    
    console.log('📨 Slack event:', event.type, '->', event.event?.type);
    
    // Handle message events with files (audio replies)
    if (event.type === 'event_callback' && event.event.type === 'message') {
      const messageEvent = event.event as any;

      // Process messages with files, but exclude bot messages and certain subtypes
      if (messageEvent.files && 
          messageEvent.files.length > 0 && 
          !messageEvent.bot_id && 
          messageEvent.subtype !== 'bot_message') {
        
        // Check if this is a thread reply (for audio processing)
        if (messageEvent.thread_ts) {
          console.log('🧵 Thread reply with files detected');
          
          // Check if any files are audio files
          const audioFiles = messageEvent.files.filter((file: any) => 
            file.mimetype?.startsWith('audio/') || 
            file.name?.toLowerCase().endsWith('.mp3') ||
            file.name?.toLowerCase().endsWith('.wav') ||
            file.name?.toLowerCase().endsWith('.m4a')
          );
          
          if (audioFiles.length > 0) {
            console.log(`🎵 Processing ${audioFiles.length} audio file(s) in thread`);
            
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
          }
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

    return res.status(200).json({ message: 'Event processed' });
  } catch (error) {
    console.error('Error handling Slack event:', error);
    return res.status(500).json({ error: 'Failed to process event' });
  }
} 