import fs from 'fs/promises';
import { ExtractedItem } from '../../types';
import { convertTextToSpeech } from '../../services/api/elevenlabs';
import { extractWithOpenAI } from '../../services/api/openai';
import { safeJsonParse } from './json';
import { getCachedResponse, setCachedResponse } from './cache';

/**
 * Extract items from text, URLs, and images
 * 
 * @param text The text to extract items from
 * @param urls URLs found in the text
 * @param images Image URLs found in the text
 * @returns Array of extracted items
 */
export async function extractItemsFromText(
  text: string, 
  urls: string[] = [], 
  images: string[] = []
): Promise<ExtractedItem[]> {
  console.log('Start extractItemsFromText function');
  console.log(`Images received: ${images.length}, URLs received: ${urls.length}`);
  
  // Check cache first
  const cacheKey = `extract_items_${text.substring(0, 100)}`;
  const cachedItems = getCachedResponse<ExtractedItem[]>(cacheKey);
  if (cachedItems) {
    console.log('Using cached extracted items');
    return cachedItems;
  }
  
  // Extract URLs from text
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const textUrls = text.match(urlRegex) || [];
  
  // Combine detected URLs from text and provided URLs from clipboard
  const allUrls = [...new Set([...textUrls, ...urls])];
  
  // Extract image URLs from text with better regex to catch more images
  const imageRegex = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?)/gi;
  const textImageUrls = text.match(imageRegex) || [];
  
  // Also try to extract image URLs from the provided URLs (they might be image hosting services)
  const potentialImageUrls = allUrls.filter(url => 
    url.includes('imgur.com') || 
    url.includes('ibb.co') || 
    url.includes('cloudinary.com') ||
    url.includes('postimg.cc') ||
    url.includes('dropbox.com') ||
    url.includes('images.unsplash.com') ||
    url.includes('media.giphy.com') ||
    url.includes('pbs.twimg.com') ||
    /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url)
  );
  
  // Combine detected image URLs and provided images
  // For data URLs from clipboard, we can't include them in the prompt (too long)
  // but we'll keep track of how many we have
  const clipboardImageCount = images.filter(img => img.startsWith('data:')).length;
  
  // Keep track of all available images so we can assign them later
  const allAvailableImages = [...textImageUrls, ...potentialImageUrls, ...images];
  console.log(`Found ${allAvailableImages.length} total images (${clipboardImageCount} from clipboard)`);
  
  // Prepare a combined text that includes information about images and URLs
  let combinedText = text;
  
  // Add information about clipboard images (if any)
  if (clipboardImageCount > 0) {
    combinedText += `\n\n[${clipboardImageCount} image(s) detected from clipboard]`;
  }
  
  const extractionPrompt = `
Extract news, tools, and prompts from this content. Return ONLY valid JSON.

Content: ${combinedText}
URLs: ${allUrls.join(', ')}

Return JSON in this exact format:
{
  "items": [
    {
      "category": "news",
      "title": "Article title",
      "content": "Brief summary",
      "url": "https://example.com",
      "imageUrl": "https://image.com/pic.jpg"
    }
  ]
}

Rules:
- category must be: "news", "tools", or "prompts"
- Only extract real, substantial content
- No duplicates or placeholders
- Keep content under 200 chars
- Use null for missing url/imageUrl
- Include ${clipboardImageCount} clipboard images if relevant
- Return ONLY the JSON object`;

  console.log('Preparing to call OpenAI API');
  try {
    // Get the content from OpenAI
    const content = await extractWithOpenAI(extractionPrompt);
    
    if (!content) {
      console.log('No content returned from OpenAI');
      return [];
    }

    console.log('Attempting to parse content');
    try {
      const parsed = safeJsonParse<{ items: ExtractedItem[] }>(content);
      console.log('Parsing successful:', !!parsed);
      
      let items = parsed?.items || [];
      
      // Filter out duplicate items based on title and content similarity
      const uniqueItems: ExtractedItem[] = [];
      const titleMap = new Map<string, boolean>();

      // Use this to detect duplicates
      for (const item of items) {
        // Normalize the title by removing emojis, spaces, and any text containing "duplicate"
        let normalizedTitle = item.title
          .replace(/[\u{1F300}-\u{1F6FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]/gu, '')
          .trim();
        
        // Remove any text that contains the word "duplicate" or in parentheses
        normalizedTitle = normalizedTitle.replace(/\s*\([^)]*\)/g, '').replace(/\s*duplicate.*$/i, '').trim();
        
        // Create a unique key combining normalized title 
        const titleKey = normalizedTitle.toLowerCase();
        
        // Check if we've seen this title before
        if (!titleMap.has(titleKey)) {
          titleMap.set(titleKey, true);
          uniqueItems.push(item);
          console.log(`Adding unique item: ${item.title}`);
        } else {
          console.log(`Skipping duplicate item: ${item.title}`);
        }
      }

      console.log(`Filtered out ${items.length - uniqueItems.length} duplicate items`);
      items = uniqueItems;
      
      // After filtering items, assign any remaining images that weren't assigned by the model
      if (items.length > 0 && allAvailableImages.length > 0) {
        console.log(`Starting image assignment: ${items.length} items, ${allAvailableImages.length} available images`);
        
        // First, clear any synthetic OpenAI-generated image URLs that might not work
        for (const item of items) {
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
            console.log(`🔄 Clearing synthetic OpenAI image URL for "${item.title}": ${item.imageUrl}`);
            item.imageUrl = undefined;
          }
        }
        
        // Get items without images (including those we just cleared)
        const itemsWithoutImages = items.filter(item => !item.imageUrl);
        
        if (itemsWithoutImages.length > 0) {
          console.log(`Found ${itemsWithoutImages.length} items without images to assign from ${allAvailableImages.length} available images`);
          
          // Prioritize news items and assign images in order
          let imageIndex = 0;
          
          // First pass: Assign to news items
          for (const item of items) {
            if (item.category === 'news' && !item.imageUrl && imageIndex < allAvailableImages.length) {
              item.imageUrl = allAvailableImages[imageIndex];
              console.log(`✅ Assigned image ${imageIndex + 1} to news item "${item.title}": ${item.imageUrl.substring(0, 50)}...`);
              imageIndex++;
            }
          }
          
          // Second pass: Assign to tools and prompts if there are remaining images
          for (const item of items) {
            if (item.category !== 'news' && !item.imageUrl && imageIndex < allAvailableImages.length) {
              item.imageUrl = allAvailableImages[imageIndex];
              console.log(`✅ Assigned image ${imageIndex + 1} to ${item.category} item "${item.title}": ${item.imageUrl.substring(0, 50)}...`);
              imageIndex++;
            }
          }
          
          console.log(`Image assignment complete: assigned ${imageIndex} images`);
        } else {
          console.log('All items already have images assigned');
        }
      }
      
      // After filtering items, generate audio for news items
      if (items && items.length > 0) {
        for (const item of items) {
          if (item.category === 'news' && item.title && item.content && item.content.length > 10) {
            try {
              const audioText = `${item.title}. ${item.content}`; // Use full content
              const audioBuffer = await convertTextToSpeech({ text: audioText });
              
              if (audioBuffer) {
                // Save audio file to disk
                const timestamp = new Date().getTime();
                const safeTitle = item.title.replace(/[^a-zA-Z0-9]/g, '_');
                const filename = `./public/audio/${safeTitle}_${timestamp}.mp3`;
                
                try {
                  // Ensure directory exists
                  await fs.mkdir('./public/audio', { recursive: true });
                  await fs.writeFile(filename, audioBuffer);
                  console.log(`Audio file saved to: ${filename}`);
                  
                  // Set the audioUrl to be the public URL path
                  item.audioUrl = `/audio/${safeTitle}_${timestamp}.mp3`;
                  console.log(`Audio URL set to: ${item.audioUrl}`);
                } catch (fileError) {
                  console.error('Error saving audio file:', fileError);
                }
              }
            } catch (error) {
              console.error('Error generating audio during extraction:', error);
            }
          }
        }
      }
      
      // Cache the results if we have items
      if (items.length > 0) {
        setCachedResponse(cacheKey, items);
      }
      
      return items;
    } catch (error) {
      console.error('Error parsing extraction result:', error);
      return [];
    }
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error; // Rethrow to be caught by the handler
  }
}

/**
 * Save extracted items to a JSON file
 * 
 * @param categorizedItems Categorized extracted items
 */
export async function saveExtractedItems(
  categorizedItems: {
    news: ExtractedItem[];
    tools: ExtractedItem[];
    prompts: ExtractedItem[];
  }
): Promise<string> {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir('./data', { recursive: true });
    
    const timestamp = new Date().getTime();
    const filename = `./data/extracted_${timestamp}.json`;
    
    await fs.writeFile(
      filename,
      JSON.stringify(categorizedItems, null, 2)
    );
    
    console.log('Extracted content saved to file:', filename);
    return filename;
  } catch (error) {
    console.error('Error saving extracted content to file:', error);
    throw error;
  }
} 