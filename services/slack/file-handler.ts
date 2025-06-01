import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { getSlackClient } from './client';

/**
 * Downloads an image from a URL and saves it to the local filesystem
 * @param imageUrl URL of the image to download
 * @returns Path to the saved image file or null if download failed
 */
export async function downloadImage(imageUrl: string): Promise<string | null> {
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
 * Process and upload an image to Slack
 * @param imageUrl The image URL (can be data URL or HTTP URL)
 * @param channelId The Slack channel ID
 * @param title Optional title for the image
 * @returns true if upload successful, false otherwise
 */
export async function uploadImageToSlack(
  imageUrl: string,
  channelId: string,
  title?: string
): Promise<boolean> {
  try {
    const slack = getSlackClient();
    let imageBuffer: Buffer | null = null;
    let imageFilename = `image-${Date.now()}.jpg`;
    
    if (imageUrl.startsWith('data:')) {
      console.log('Processing data URL image for file upload...');
      // For data URLs, extract the base64 data
      const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        imageBuffer = Buffer.from(base64Data, 'base64');
        const extension = mimeType.split('/')[1] || 'jpg';
        imageFilename = `image-${Date.now()}.${extension}`;
        console.log(`✅ Successfully extracted image from data URL, MIME: ${mimeType}, size: ${imageBuffer.length} bytes`);
      } else {
        console.log('❌ Failed to parse data URL format');
        return false;
      }
    } else if (imageUrl.startsWith('http')) {
      console.log('🌐 Downloading HTTP image for upload...');
      // Download the image first
      const downloadedImagePath = await downloadImage(imageUrl);
      
      if (downloadedImagePath) {
        imageBuffer = await fs.readFile(downloadedImagePath);
        imageFilename = path.basename(downloadedImagePath);
        
        // Clean filename
        imageFilename = imageFilename.split('?')[0];
        if (!imageFilename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          imageFilename += '.jpg';
        }
        
        console.log(`✅ Read downloaded image file, size: ${imageBuffer.length} bytes`);
        
        // Clean up the downloaded file
        try {
          await fs.unlink(downloadedImagePath);
          console.log('🗑️ Cleaned up temporary image file');
        } catch {
          console.log('Note: Could not clean up temporary file (not critical)');
        }
      } else {
        console.log(`❌ Failed to download image from URL: ${imageUrl}`);
        return false;
      }
    } else {
      console.log('❌ Unknown image URL format, skipping upload');
      return false;
    }
    
    // Upload the image to Slack
    if (imageBuffer) {
      console.log(`📤 Uploading image to Slack: ${imageFilename}, size: ${imageBuffer.length} bytes`);
      
      // Detect file type
      const fileExtension = imageFilename.split('.').pop()?.toLowerCase() || 'jpg';
      const filetype = fileExtension === 'png' ? 'png' : 
                      fileExtension === 'gif' ? 'gif' : 
                      fileExtension === 'webp' ? 'webp' : 'jpg';
      
      await slack.files.uploadV2({
        channel_id: channelId,
        file: imageBuffer,
        filename: imageFilename,
        filetype: filetype,
        ...(title && { title })
      });
      
      console.log('✅ Image file uploaded to Slack successfully!');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error uploading image to Slack:', error);
    return false;
  }
}

/**
 * Upload audio file to Slack
 * @param audioUrl Local path to audio file or URL
 * @param channelId The Slack channel ID
 * @param title Title for the audio file
 * @returns true if upload successful, false otherwise
 */
export async function uploadAudioToSlack(
  audioUrl: string,
  channelId: string,
  title: string
): Promise<boolean> {
  try {
    const slack = getSlackClient();
    let audioBuffer: Buffer | null = null;
    
    // If we have a local audioUrl, read the audio file
    if (!audioUrl.startsWith('http')) {
      try {
        const filePath = `./public${audioUrl}`;
        audioBuffer = await fs.readFile(filePath);
        console.log(`Read audio file from ${filePath}, size: ${audioBuffer.length} bytes`);
      } catch (error) {
        console.error(`Error reading audio file from ${audioUrl}:`, error);
        return false;
      }
    }
    
    // Upload the audio to Slack
    if (audioBuffer) {
      console.log(`Posting audio as file for "${title}"`);
      await slack.files.uploadV2({
        channel_id: channelId,
        file: audioBuffer,
        filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp3`,
        title: `🔊 ${title}`,
      });
      console.log('Audio posted to Slack successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error posting audio to Slack:', error);
    return false;
  }
} 