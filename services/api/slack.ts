import { WebClient } from '@slack/web-api';
import { SLACK_CHANNEL_ID } from '../../constants';
import { SlackBlock, SlackMessageData, VocabularyItem } from '../../types';
import fs from 'fs/promises';
import axios from 'axios';
import path from 'path';

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Downloads an image from a URL and saves it to the local filesystem
 * @param imageUrl URL of the image to download
 * @returns Path to the saved image file or null if download failed
 */
async function downloadImage(imageUrl: string): Promise<string | null> {
  try {
    console.log(`Attempting to download image from: ${imageUrl.substring(0, 100)}...`);
    
    // Create a unique filename based on the current timestamp
    const timestamp = Date.now();
    const fileExtension = path.extname(imageUrl) || '.jpg';
    const filename = `image-${timestamp}${fileExtension}`;
    const savePath = path.join('./public/uploads', filename);
    
    // Ensure the uploads directory exists
    await fs.mkdir('./public/uploads', { recursive: true });
    
    // Download the image
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'arraybuffer',
      timeout: 15000, // 15 seconds timeout for download
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Save the image to disk
    await fs.writeFile(savePath, Buffer.from(response.data));
    console.log(`✅ Image downloaded and saved to: ${savePath}`);
    
    return savePath;
  } catch (error) {
    console.error('❌ Error downloading image:', error);
    return null;
  }
}

/**
 * Post a message to Slack
 * 
 * @param messageData The message data to post
 * @param channelId The channel ID to post to
 * @returns The Slack API response
 */
export async function postToSlack(messageData: SlackMessageData, channelId: string = SLACK_CHANNEL_ID) {
  const { title, summary, url, pictureUrl, audioUrl, category, quiz, vocabulary } = messageData;
  
  // More precise logging of image URL status
  const hasImage = pictureUrl !== null && pictureUrl !== undefined && pictureUrl !== '';
  console.log(`Posting to Slack with image: ${hasImage ? 'yes' : 'no'}`);
  
  // Generate catchy heading with emoji based on category
  let heading = '';
  if (category === 'news') {
    heading = `📰 *${title}!*`;
  } else if (category === 'tools') {
    heading = `🛠️ *Cool Tool Alert: ${title}*`;
  } else if (category === 'prompts') {
    heading = `✨ *Prompt Magic: ${title}*`;
  }
  
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${heading}\n${summary}${url ? `\n<${url}|Read more>` : ''}`,
      }
    },
    { type: 'divider' }
  ];

  // Note: We'll handle all images as file uploads since many URLs (like Google's) aren't accessible to Slack directly

  // Add vocabulary if available
  if (vocabulary && vocabulary.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*🔍 Key Terminology*' },
    });
    
    vocabulary.forEach(v => {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `• *${v.term}*: ${v.definition}` },
      });
    });
    
    blocks.push({ type: 'divider' });
  }

  // Add quiz if available (news category)
  if (quiz && quiz.length > 0) {
    // Display all questions
    quiz.forEach((q, index) => {
      // Truncate options to prevent Slack API errors (75 char limit for options)
      const truncatedOptions = q.options.map(opt => 
        opt.length > 75 ? opt.substring(0, 72) + '...' : opt
      );
      
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Q${index + 1}: ${q.question}*` },
        accessory: {
          type: 'static_select',
          placeholder: { type: 'plain_text', text: 'Choose an answer' },
          options: truncatedOptions.map((opt) => ({
            text: { type: 'plain_text', text: opt },
            value: opt,
          })),
          action_id: `quiz_answer_${index}`,
        },
      } as SlackBlock);
    });
    
    // Add a note about responses being private
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: "_Your answers will be visible only to you_"
        }
      ]
    } as SlackBlock);
  }
  
  // Post the text message first
  const response = await slack.chat.postMessage({
    channel: channelId,
    blocks,
    text: `New ${category}: ${title}`, // Fallback text
  });

  // Handle image - download and upload all images as files to main channel
  if (hasImage && pictureUrl && response.ts) {
    try {
      console.log(`Processing image for Slack upload: ${pictureUrl.substring(0, 100)}...`);
      
      let imageBuffer: Buffer | null = null;
      let imageFilename = `image-${Date.now()}.jpg`;
      
      if (pictureUrl.startsWith('data:')) {
        console.log('Processing data URL image for file upload...');
        // For data URLs, extract the base64 data
        const matches = pictureUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          imageBuffer = Buffer.from(base64Data, 'base64');
          const extension = mimeType.split('/')[1] || 'jpg';
          imageFilename = `image-${Date.now()}.${extension}`;
          console.log(`✅ Successfully extracted image from data URL, MIME: ${mimeType}, size: ${imageBuffer.length} bytes`);
        } else {
          console.log('❌ Failed to parse data URL format');
        }
      } else if (pictureUrl.startsWith('http')) {
        console.log('🌐 Downloading HTTP image for upload...');
        // Download the image first, then upload to Slack
        const downloadedImagePath = await downloadImage(pictureUrl);
        
        if (downloadedImagePath) {
          imageBuffer = await fs.readFile(downloadedImagePath);
          imageFilename = path.basename(downloadedImagePath);
          
          // Clean filename by removing query parameters and ensuring proper extension
          imageFilename = imageFilename.split('?')[0]; // Remove query parameters
          if (!imageFilename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            imageFilename += '.jpg'; // Add extension if missing
          }
          
          console.log(`✅ Read downloaded image file, size: ${imageBuffer.length} bytes, cleaned filename: ${imageFilename}`);
          
          // Clean up the downloaded file
          try {
            await fs.unlink(downloadedImagePath);
            console.log('🗑️ Cleaned up temporary image file');
          } catch {
            console.log('Note: Could not clean up temporary file (not critical)');
          }
        } else {
          console.log(`❌ Failed to download image from URL: ${pictureUrl}`);
        }
      } else {
        console.log('❌ Unknown image URL format, skipping upload');
      }
      
      // Upload the image to Slack as a file attachment to the main channel
      if (imageBuffer) {
        console.log(`📤 Uploading image to Slack main channel: ${imageFilename}, size: ${imageBuffer.length} bytes`);
        
        // Detect file type for better Slack recognition
        const fileExtension = imageFilename.split('.').pop()?.toLowerCase() || 'jpg';
        const filetype = fileExtension === 'png' ? 'png' : 
                        fileExtension === 'gif' ? 'gif' : 
                        fileExtension === 'webp' ? 'webp' : 'jpg';
        
        await slack.files.uploadV2({
          channel_id: channelId,
          file: imageBuffer,
          filename: imageFilename,
          filetype: filetype,
          // title: `📷 Image for "${title}"`,
        });
        
        console.log('✅ Image file uploaded to Slack main channel successfully!');
      } else {
        console.log('❌ No image buffer available for upload');
      }
    } catch (error) {
      console.error('Error handling image for Slack:', error);
    }
  }

  // Handle audio attachment
  if (audioUrl && response.ts) {
    try {
      let audioBuffer: Buffer | null = null;
      
      // If we have an audioUrl from extraction, read the audio file
      if (!audioUrl.startsWith('http')) {
        try {
          const filePath = `./public${audioUrl}`;
          audioBuffer = await fs.readFile(filePath);
          console.log(`Read audio file from ${filePath}, size: ${audioBuffer.length} bytes`);
        } catch (error) {
          console.error(`Error reading audio file from ${audioUrl}:`, error);
        }
      }
      
      // Upload the audio to Slack as a file attachment
      if (audioBuffer) {
        console.log(`Posting audio as file for "${title}"`);
        await slack.files.uploadV2({
          channel_id: channelId,
          file: audioBuffer,
          filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp3`,
          title: `🔊 Listen to "${title}"`,
          // initial_comment: "🎧 Audio version of this article"
        });
        console.log('Audio posted to Slack successfully');
      }
    } catch (error) {
      console.error('Error posting audio to Slack:', error);
    }
  }

  return response;
}

/**
 * Post vocabulary as a reply to a news item
 * 
 * @param vocabulary The vocabulary items to post
 * @param parentMessageId The parent message ID to reply to
 * @param channelId The channel ID to post to
 * @returns The Slack API response
 */
export async function postVocabularyAsReply(
  vocabulary: VocabularyItem[], 
  parentMessageId: string, 
  channelId: string = SLACK_CHANNEL_ID
) {
  if (!vocabulary || vocabulary.length === 0) {
    return;
  }
  
  // Create vocabulary blocks
  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*📚 Key Terminology*' },
    }
  ];
  
  vocabulary.forEach(v => {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `• *${v.term}*: ${v.definition}` },
    });
  });
  
  // Post as a thread reply
  const response = await slack.chat.postMessage({
    channel: channelId,
    thread_ts: parentMessageId,
    blocks,
    text: "Key terminology for this news item",
  });
  
  return response;
}

/**
 * Post quiz questions as a reply to a news item
 * 
 * @param quiz The quiz questions to post
 * @param parentMessageId The parent message ID to reply to
 * @param channelId The channel ID to post to
 * @returns The Slack API response
 */
export async function postQuizAsReply(
  quiz: Array<{ question: string; options: string[]; correct: string }>, 
  parentMessageId: string, 
  channelId: string = SLACK_CHANNEL_ID
) {
  if (!quiz || quiz.length === 0) {
    return;
  }
  
  // Create quiz blocks
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*🧠 Test Your Knowledge!*' },
    }
  ];
  
  // Add each quiz question
  quiz.forEach((q, index) => {
    // Truncate options to prevent Slack API errors (75 char limit for options)
    const truncatedOptions = q.options.map(opt => 
      opt.length > 75 ? opt.substring(0, 72) + '...' : opt
    );
    
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Q${index + 1}: ${q.question}*` },
      accessory: {
        type: 'static_select',
        placeholder: { type: 'plain_text', text: 'Choose an answer' },
        options: truncatedOptions.map((opt) => ({
          text: { type: 'plain_text', text: opt },
          value: opt,
        })),
        action_id: `quiz_answer_${index}`,
      },
    } as SlackBlock);
  });
  
  // Add a note about responses being private
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: "_Your answers will be visible only to you_"
      }
    ]
  } as SlackBlock);
  
  // Post as a thread reply
  const response = await slack.chat.postMessage({
    channel: channelId,
    thread_ts: parentMessageId,
    blocks,
    text: "Quiz questions for this news item",
  });
  
  return response;
}

/**
 * Post a quiz to Slack
 * 
 * @param messageData The message data with quiz
 * @param channelId The channel ID to post to
 * @returns The Slack API response
 */
export async function postQuizToSlack(messageData: SlackMessageData, channelId: string = SLACK_CHANNEL_ID) {
  const { title, summary, quiz, pictureUrl } = messageData;
  
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🧠 *${title}*\n${summary}`,
      }
    },
    { type: 'divider' }
  ];

  // Note: We'll handle all images as file uploads since many URLs aren't accessible to Slack directly

  // Add quiz
  if (quiz && quiz.length > 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '*🧠 Test Your Knowledge!*' },
    });
    
    // Display all questions
    quiz.forEach((q, index) => {
      // Truncate options to prevent Slack API errors (75 char limit for options)
      const truncatedOptions = q.options.map(opt => 
        opt.length > 75 ? opt.substring(0, 72) + '...' : opt
      );
      
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Q${index + 1}: ${q.question}*` },
        accessory: {
          type: 'static_select',
          placeholder: { type: 'plain_text', text: 'Choose an answer' },
          options: truncatedOptions.map((opt) => ({
            text: { type: 'plain_text', text: opt },
            value: opt,
          })),
          action_id: `quiz_answer_${index}`,
        },
      } as SlackBlock);
    });
    
    // Add a note about responses being private
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: "_Your answers will be visible only to you_"
        }
      ]
    } as SlackBlock);
  }

  // Post the text message first
  const response = await slack.chat.postMessage({
    channel: channelId,
    blocks,
    text: `Quiz: ${title}`, // Fallback text
  });

  // Handle image as an attachment for quiz
  if (pictureUrl && response.ts) {
    try {
      console.log(`Processing quiz image: ${pictureUrl.substring(0, 100)}...`);
      
      let imageBuffer: Buffer | null = null;
      let imageFilename = `quiz-image-${Date.now()}.jpg`;
      
      if (pictureUrl.startsWith('data:')) {
        console.log('Processing data URL image for quiz file upload...');
        // For data URLs, extract the base64 data
        const matches = pictureUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          imageBuffer = Buffer.from(base64Data, 'base64');
          const extension = mimeType.split('/')[1] || 'jpg';
          imageFilename = `quiz-image-${Date.now()}.${extension}`;
          console.log(`✅ Successfully extracted quiz image from data URL, MIME: ${mimeType}, size: ${imageBuffer.length} bytes`);
        } else {
          console.log('❌ Failed to parse quiz data URL format');
        }
      } else if (pictureUrl.startsWith('http')) {
        console.log('🌐 Downloading HTTP quiz image for upload...');
        // Download the image first, then upload to Slack
        const downloadedImagePath = await downloadImage(pictureUrl);
        
        if (downloadedImagePath) {
          imageBuffer = await fs.readFile(downloadedImagePath);
          imageFilename = path.basename(downloadedImagePath);
          
          // Clean filename by removing query parameters and ensuring proper extension
          imageFilename = imageFilename.split('?')[0]; // Remove query parameters
          if (!imageFilename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            imageFilename += '.jpg'; // Add extension if missing
          }
          
          console.log(`✅ Read downloaded image file, size: ${imageBuffer.length} bytes, cleaned filename: ${imageFilename}`);
          
          // Clean up the downloaded file
          try {
            await fs.unlink(downloadedImagePath);
            console.log('🗑️ Cleaned up temporary image file');
          } catch {
            console.log('Note: Could not clean up temporary file (not critical)');
          }
        } else {
          console.log(`❌ Failed to download quiz image from URL: ${pictureUrl}`);
        }
      } else {
        console.log('❌ Unknown quiz image URL format, skipping upload');
      }
      
      // Upload the image to Slack as a file attachment to the main channel
      if (imageBuffer) {
        console.log(`📤 Uploading quiz image to Slack main channel: ${imageFilename}, size: ${imageBuffer.length} bytes`);
        
        // Detect file type for better Slack recognition
        const fileExtension = imageFilename.split('.').pop()?.toLowerCase() || 'jpg';
        const filetype = fileExtension === 'png' ? 'png' : 
                        fileExtension === 'gif' ? 'gif' : 
                        fileExtension === 'webp' ? 'webp' : 'jpg';
        
        await slack.files.uploadV2({
          channel_id: channelId,
          file: imageBuffer,
          filename: imageFilename,
          filetype: filetype,
          title: `📷 Image for "${title}" quiz`,
          // No thread_ts so it appears with the main message, not as a reply
          initial_comment: "📸 Image for this quiz"
        });
        
        console.log('✅ Quiz image file uploaded to Slack main channel successfully!');
      } else {
        console.log('❌ No quiz image buffer available for upload');
      }
    } catch (error) {
      console.error('Error handling quiz image for Slack:', error);
    }
  }

  // Handle audio for quiz
  if (messageData.audioUrl && response.ts) {
    try {
      let audioBuffer: Buffer | null = null;
      
      // If we have an audioUrl from extraction, read the audio file
      if (!messageData.audioUrl.startsWith('http')) {
        try {
          const filePath = `./public${messageData.audioUrl}`;
          audioBuffer = await fs.readFile(filePath);
          console.log(`Read quiz audio file from ${filePath}, size: ${audioBuffer.length} bytes`);
        } catch (error) {
          console.error(`Error reading quiz audio file from ${messageData.audioUrl}:`, error);
        }
      }
      
      // Upload audio as a file attachment
      if (audioBuffer) {
        console.log(`Posting audio for quiz "${title}"`);
        await slack.files.uploadV2({
          channel_id: channelId,
          file: audioBuffer,
          filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp3`,
          title: `🔊 Listen to "${title}" quiz`,
          initial_comment: "🎧 Audio introduction to this quiz"
        });
        console.log('Quiz audio posted to Slack successfully');
      }
    } catch (error) {
      console.error('Error posting audio for quiz:', error);
    }
  }

  return response;
} 