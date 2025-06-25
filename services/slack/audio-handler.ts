import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
import axios from 'axios';
import { savePronunciationResponse, PronunciationResponseData } from '../quiz';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory cache to prevent duplicate processing
const processedFiles = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of processedFiles.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      processedFiles.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

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

export async function handleAudioReply(eventData: SlackEventData, slack: WebClient): Promise<void> {
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

    // Check for duplicate processing
    const audioFile = audioFiles[0];
    const cacheKey = `${audioFile.id}-${eventData.thread_ts}`;
    const now = Date.now();
    
    if (processedFiles.has(cacheKey)) {
      const lastProcessed = processedFiles.get(cacheKey)!;
      if (now - lastProcessed < CACHE_DURATION) {
        console.log(`🔄 Skipping duplicate processing of file ${audioFile.id} (processed ${Math.round((now - lastProcessed) / 1000)}s ago)`);
        return;
      }
    }
    
    // Mark this file as being processed
    processedFiles.set(cacheKey, now);
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
    console.log('🎧 Processing audio file:', audioFile.name);
    await processAudioFile(audioFile, originalText, eventData, slack);

  } catch (error) {
    console.error('❌ Error handling audio reply:', error);
  }
}

export function extractNewsTextFromMessage(message: { blocks?: unknown[]; text?: string }): string | null {
  try {
    // Extract text from Slack message blocks
    if (message.blocks) {
      for (const block of message.blocks) {
        const slackBlock = block as { type?: string; text?: { text?: string } };
        if (slackBlock.type === 'section' && slackBlock.text) {
          // Remove markdown formatting and emoji, extract the main content
          let text = slackBlock.text.text || '';
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
  audioFile: {
    id: string;
    name: string;
    mimetype: string;
    url_private: string;
    url_private_download: string;
  },
  originalText: string,
  eventData: SlackEventData,
  slack: WebClient
): Promise<void> {
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

    // Extract score from feedback (format: "Score: XX/100")
    let score = 0;
    if (feedback) {
      const scoreMatch = feedback.match(/Score:\s*(\d+)\/100/);
      if (scoreMatch) {
        score = parseInt(scoreMatch[1], 10);
      }
    }

    // Save the pronunciation response
    const responseData: PronunciationResponseData = {
      userId: eventData.user,
      threadId: eventData.thread_ts || '',
      originalText: originalText,
      transcribedText: transcription.text,
      score: score,
      feedback: feedback || '',
      timestamp: new Date().toISOString()
    };
    
    try {
      await savePronunciationResponse(responseData);
      console.log(`💾 Saved pronunciation response: score=${score}/100`);
    } catch (saveError) {
      console.error('❌ Error saving pronunciation response:', saveError);
    }

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