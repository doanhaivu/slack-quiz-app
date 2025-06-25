import { NextApiRequest, NextApiResponse } from 'next';
import { SLACK_CHANNEL_ID } from '../../../constants';
import { ExtractedItem } from '../../../types';
import { postToSlack } from '../../../services/slack';
import { processToolsItems, processPromptsItems } from '../../../utils/api/items';
import { validateImageUrl } from '../../../utils/api/validation';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { extractedContent, images, urls, channelId } = req.body;
    
    if (!extractedContent) {
      return res.status(400).json({ error: 'Extracted content is required' });
    }
    
    const targetChannelId = channelId || SLACK_CHANNEL_ID;
    console.log(`post_extracted_only action with ${images?.length || 0} images and ${urls?.length || 0} URLs`);
    
    const results: Array<{
      category: string;
      title?: string;
      action?: string;
      count?: number;
      slackMessageId?: string;
    }> = [];
    const postPromises = [];
    
    // Process news items without quiz/vocabulary
    if (extractedContent.news && extractedContent.news.length > 0) {
      // First, detect and remove duplicate items
      const uniqueItems: ExtractedItem[] = [];
      const titleMap = new Map<string, boolean>();

      for (const item of extractedContent.news) {
        // Normalize the title by removing emojis and duplicates
        let normalizedTitle = item.title
          .replace(/[\u{1F300}-\u{1F6FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]/gu, '')
          .trim();
        
        normalizedTitle = normalizedTitle.replace(/\s*\([^)]*\)/g, '').replace(/\s*duplicate.*$/i, '').trim();
        
        const titleKey = normalizedTitle.toLowerCase();
        
        if (!titleMap.has(titleKey)) {
          titleMap.set(titleKey, true);
          uniqueItems.push(item);
          console.log(`Adding unique news item: ${item.title}`);
        } else {
          console.log(`Skipping duplicate news item: ${item.title}`);
        }
      }
      
      console.log(`Filtered out ${extractedContent.news.length - uniqueItems.length} duplicate news items`);
      extractedContent.news = uniqueItems;

      // Handle pasted images
      const allPastedImages = images || [];
      
      if (allPastedImages.length > 0) {
        console.log(`Found ${allPastedImages.length} pasted images to potentially use with news items`);
        
        // Clear synthetic OpenAI-generated image URLs
        for (const item of extractedContent.news) {
          if (item.imageUrl && (
            item.imageUrl.includes('images.openai.com') ||
            item.imageUrl.includes('openai.com/assets') ||
            item.imageUrl.includes('example.com') ||
            item.imageUrl.includes('placeholder') ||
            item.imageUrl.startsWith('https://ai-') ||
            item.imageUrl.startsWith('https://synthetic-') ||
            item.imageUrl.includes('/og-image.png') ||
            item.imageUrl.includes('stock-photo') ||
            item.imageUrl.includes('generic-image')
          )) {
            console.log(`🔄 Replacing synthetic OpenAI image URL for "${item.title}": ${item.imageUrl}`);
            item.imageUrl = undefined;
          }
        }
        
        // Assign pasted images to news items without images
        let imageIndex = 0;
        for (const item of extractedContent.news) {
          if (!item.imageUrl && imageIndex < allPastedImages.length) {
            console.log(`✅ Assigning pasted image ${imageIndex + 1} to news item: ${item.title}`);
            item.imageUrl = allPastedImages[imageIndex];
            imageIndex++;
          }
        }
        
        console.log(`Assigned ${imageIndex} images to news items`);
      }
      
      // Try to extract images from URLs if not already assigned
      for (const item of extractedContent.news) {
        if (!item.imageUrl && item.url) {
          if (
            item.url.includes('imgur.com') || 
            item.url.includes('ibb.co') || 
            item.url.includes('cloudinary.com') ||
            item.url.includes('postimg.cc') ||
            item.url.includes('images.unsplash.com') ||
            item.url.includes('media.giphy.com') ||
            item.url.includes('pbs.twimg.com') ||
            /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(item.url)
          ) {
            console.log(`Using URL as image for news item: ${item.title}`);
            item.imageUrl = item.url;
          }
        }
      }
      
      // Check for emoji images that should be ignored
      for (const item of extractedContent.news) {
        if (item.imageUrl) {
          const emojiPatterns = [
            /emoji/i,
            /[\u{1F300}-\u{1F6FF}]/u,
            /:[a-z_]+:/i,
            /^https?:\/\/[^\/]+\/emoji\//i
          ];
          
          const isLikelyEmoji = item.imageUrl ? 
            emojiPatterns.some(pattern => pattern.test(item.imageUrl as string)) : 
            false;
          
          if (isLikelyEmoji) {
            console.log(`Detected emoji as image URL for item "${item.title}", clearing it: ${item.imageUrl}`);
            item.imageUrl = null;
          }
        }
      }
      
      // Post each news item individually
      for (const item of extractedContent.news) {
        const validatedImageUrl = item.imageUrl && validateImageUrl(item.imageUrl) ? item.imageUrl : null;
        
        if (item.imageUrl && !validatedImageUrl) {
          console.log(`Invalid image URL detected for "${item.title}", removing: ${item.imageUrl}`);
          item.imageUrl = null;
        }
        
        const hasValidImage = validatedImageUrl !== null;
        console.log(`Preparing to post news item: ${item.title}, has valid image: ${hasValidImage}`);
        
        postPromises.push(
          postToSlack({
            title: item.title,
            summary: item.content,
            url: item.url || null,
            pictureUrl: validatedImageUrl,
            audioUrl: item.audioUrl || null,
            category: 'news',
            // Don't include quiz or vocabulary
          }, targetChannelId).then(slackResponse => {
            // Store the message ID in the item
            item.slackMessageId = slackResponse.ts;
            
            results.push({
              category: 'news',
              title: item.title,
              action: 'extracted_only',
              slackMessageId: slackResponse.ts
            });
          })
        );
      }
    }
    
    // Process tools items
    if (extractedContent.tools && extractedContent.tools.length > 0) {
      const hasRealToolsItems = extractedContent.tools.some(
        (item: ExtractedItem) => item.content.length >= 100 || item.url
      );
      
      if (hasRealToolsItems) {
        postPromises.push(
          processToolsItems(extractedContent.tools, targetChannelId).then(toolsResult => {
            if (toolsResult.count > 0) {
              results.push(toolsResult);
            }
          })
        );
      } else {
        console.log('Skipping tools items as they appear to be generic placeholders');
      }
    }
    
    // Process prompts items
    if (extractedContent.prompts && extractedContent.prompts.length > 0) {
      const hasRealPromptsItems = extractedContent.prompts.some(
        (item: ExtractedItem) => item.content.length >= 100 || item.url
      );
      
      if (hasRealPromptsItems) {
        postPromises.push(
          processPromptsItems(extractedContent.prompts, targetChannelId).then(promptsResult => {
            if (promptsResult.count > 0) {
              results.push(promptsResult);
            }
          })
        );
      } else {
        console.log('Skipping prompts items as they appear to be generic placeholders');
      }
    }
    
    // Wait for all posting operations to complete
    await Promise.all(postPromises);
    
    return res.status(200).json({
      message: 'Extracted items posted to Slack successfully',
      results,
      extractedContent // Return the updated content with message IDs
    });
  } catch (error) {
    console.error('Error posting extracted content:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
} 