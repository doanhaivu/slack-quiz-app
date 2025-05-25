import { NextApiRequest, NextApiResponse } from 'next';
import { SLACK_CHANNEL_ID } from '../../constants';
import { ExtractedItem, QuizQuestion } from '../../types';
import { extractItemsFromText, saveExtractedItems } from '../../utils/api/extract';
import { processNewsItem, saveQuizData } from '../../utils/api/quiz';
import { processToolsItems, processPromptsItems } from '../../utils/api/items';
import { postToSlack, postVocabularyAsReply, postQuizAsReply, postQuizToSlack } from '../../services/api/slack';

// Check configurations
console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);
console.log('ElevenLabs API Key configured:', !!process.env.ELEVENLABS_API_KEY);
console.log('Slack API Key configured:', !!process.env.SLACK_BOT_TOKEN);

/**
 * Validates if an image URL is likely to work with Slack
 * @param url The image URL to validate
 * @returns boolean indicating if the URL is valid for Slack
 */
function validateImageUrl(url: string | null): boolean {
  if (!url) return false;
  
  // Data URLs are valid - our Slack service can handle them by converting to buffers
  if (url.startsWith('data:image/')) {
    console.log('Valid data URL image detected');
    return true;
  }
  
  // Check for common image extensions
  const validExtensions = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
  
  // Check for URLs that Slack can access (public URLs)
  const validDomains = [
    'imgur.com', 'ibb.co', 'postimg.cc', 
    'cloudinary.com', 'res.cloudinary.com',
    'unsplash.com', 'images.unsplash.com',
    'media.giphy.com', 'giphy.com',
    'pbs.twimg.com',
    'githubusercontent.com',
    'beehiiv.com', 'googleusercontent.com',
    'lh3.googleusercontent.com', 'lh4.googleusercontent.com',
    'lh5.googleusercontent.com', 'lh6.googleusercontent.com',
    'ci3.googleusercontent.com', 'ci4.googleusercontent.com',
    'storage.googleapis.com'
  ];
  
  // Reject local URLs and other problematic formats (but allow data URLs)
  if (
    url.includes('localhost') || 
    url.includes('127.0.0.1') ||
    url.startsWith('file:') ||
    url.includes('emoji') ||
    (!url.startsWith('http') && !url.startsWith('data:'))
  ) {
    console.log(`Image URL validation failed - invalid format: ${url}`);
    return false;
  }
  
  // For HTTP URLs, check if it has a valid extension or comes from a known image domain
  if (url.startsWith('http')) {
    const hasValidExtension = validExtensions.test(url);
    const isFromValidDomain = validDomains.some(domain => url.includes(domain));
    
    if (!hasValidExtension && !isFromValidDomain) {
      console.log(`Image URL validation failed - not recognized as image: ${url}`);
      return false;
    }
  }
  
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get channel ID from request or use default
    const channelId = req.body.channelId || SLACK_CHANNEL_ID;
    console.log(`Using Slack channel ID: ${channelId}`);
    
    // Handle content extraction only
    if (req.body.action === 'extract') {
      console.log('Starting extraction process');
      const { text, images, urls } = req.body;
      
      if ((!text || typeof text !== 'string') && (!images || !images.length) && (!urls || !urls.length)) {
        console.log('No content provided for extraction');
        return res.status(400).json({ error: 'Text, images, or URLs are required' });
      }

      console.log('Calling extraction function');
      // Extract items from the provided content
      const extractedItems = await extractItemsFromText(text || '', urls || [], images || []);
      
      console.log('Received extraction results:', extractedItems.length, 'items found');
      
      if (!extractedItems.length) {
        console.log('No items extracted from text');
        return res.status(400).json({ error: 'No news, tools, or prompts found in the text' });
      }

      // Group items by category
      const categorizedItems = {
        news: extractedItems.filter(item => item.category === 'news'),
        tools: extractedItems.filter(item => item.category === 'tools'),
        prompts: extractedItems.filter(item => item.category === 'prompts')
      };
      
      console.log('Categorized items:', 
        'news:', categorizedItems.news.length, 
        'tools:', categorizedItems.tools.length, 
        'prompts:', categorizedItems.prompts.length
      );

      // Process each news item to add quiz and vocabulary
      const promises = [];
      
      if (categorizedItems.news.length > 0) {
        for (const newsItem of categorizedItems.news) {
          promises.push(processNewsItem(newsItem));
        }
      }
      
      // Wait for all parallel operations to complete
      await Promise.all(promises);
      
      // Save the extracted content to a JSON file
      try {
        await saveExtractedItems(categorizedItems);
      } catch (error) {
        console.error('Error saving extracted content to file:', error);
      }
      
      console.log('Extraction complete, sending response');
      return res.status(200).json({
        message: 'Content extracted successfully',
        extractedContent: categorizedItems
      });
    }
    
    // Handle generating quiz and vocabulary for updated content for a specific item
    else if (req.body.action === 'generate_item') {
      console.log('Generating quiz and vocabulary for an individual item');
      const { item } = req.body;
      
      if (!item) {
        return res.status(400).json({ error: 'Item is required' });
      }
      
      let result;
      
      if (item.category === 'news') {
        result = await processNewsItem(item);
      } else {
        // For tools and prompts, just return the item as is - no generation needed
        result = item;
      }
      
      return res.status(200).json({
        message: 'Item processed successfully',
        item: result
      });
    }
    
    // Handle posting a single item to Slack
    else if (req.body.action === 'post_single_item') {
      const { category, item } = req.body;
      
      if (!category || !item) {
        return res.status(400).json({ error: 'Category and item are required' });
      }
      
      let result;
      
      if (category === 'news') {
        // Validate the image URL before posting
        const validatedImageUrl = item.imageUrl && validateImageUrl(item.imageUrl) ? item.imageUrl : null;
        if (item.imageUrl && !validatedImageUrl) {
          console.log(`Removing invalid image URL before posting news item: ${item.title}`);
        }
        
        // Post a single news item
        const slackResponse = await postToSlack({
          title: item.title,
          summary: item.content,
          url: item.url || null,
          pictureUrl: validatedImageUrl, // Use validated URL
          audioUrl: item.audioUrl || null,
          category: 'news',
          quiz: item.quiz || [],
          vocabulary: item.vocabulary || []
        }, channelId);
        
        // Save quiz data if available
        if (item.quiz && item.vocabulary) {
          await saveQuizData(
            item.quiz,
            item.vocabulary,
            slackResponse.ts
          );
        }
        
        result = {
          category: 'news',
          title: item.title,
          slackMessageId: slackResponse.ts
        };
      } 
      else if (category === 'tools') {
        // Post a single tool item
        const toolsResponse = await processToolsItems([item], channelId);
        result = toolsResponse;
      }
      else if (category === 'prompts') {
        // Post a single prompt item
        const promptsResponse = await processPromptsItems([item], channelId);
        result = promptsResponse;
      }
      
      return res.status(200).json({
        message: 'Item posted to Slack successfully',
        result
      });
    }
    
    // Handle posting only the extracted items without quiz or vocabulary
    else if (req.body.action === 'post_extracted_only') {
      const { extractedContent, images, urls } = req.body;
      
      if (!extractedContent) {
        return res.status(400).json({ error: 'Extracted content is required' });
      }
      
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
            console.log(`Adding unique news item: ${item.title}`);
          } else {
            console.log(`Skipping duplicate news item: ${item.title}`);
          }
        }
        
        console.log(`Filtered out ${extractedContent.news.length - uniqueItems.length} duplicate news items`);
        extractedContent.news = uniqueItems;

        // First, check if we have images to distribute among news items
        const allPastedImages = images || [];
        
        if (allPastedImages.length > 0) {
          console.log(`Found ${allPastedImages.length} pasted images to potentially use with news items`);
          allPastedImages.forEach((img: string, idx: number) => {
            console.log(`Pasted image ${idx + 1}: ${img.substring(0, 50)}...`);
          });
          
          // First, clear any synthetic OpenAI-generated image URLs
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
            console.log(`🔍 Checking item "${item.title}": has imageUrl = ${!!item.imageUrl}, imageIndex = ${imageIndex}, available images = ${allPastedImages.length}`);
            if (!item.imageUrl && imageIndex < allPastedImages.length) {
              console.log(`✅ Assigning pasted image ${imageIndex + 1} to news item: ${item.title}`);
              item.imageUrl = allPastedImages[imageIndex];
              console.log(`✅ Successfully assigned image to "${item.title}": ${item.imageUrl.substring(0, 50)}...`);
              imageIndex++;
            } else if (item.imageUrl) {
              console.log(`⚠️  Item "${item.title}" already has imageUrl: ${item.imageUrl.substring(0, 50)}...`);
            } else if (imageIndex >= allPastedImages.length) {
              console.log(`⚠️  No more images available (used ${imageIndex}/${allPastedImages.length})`);
            }
          }
          
          console.log(`Assigned ${imageIndex} images to news items`);
        } else {
          console.log('No pasted images available to assign to news items');
        }
        
        // Also try to extract images from URLs if not already assigned
        for (const item of extractedContent.news) {
          if (!item.imageUrl && item.url) {
            // Check if the URL might contain an image
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
            // Define emoji patterns to detect
            const emojiPatterns = [
              /emoji/i,                         // Contains "emoji" in the URL
              /[\u{1F300}-\u{1F6FF}]/u,         // Contains Unicode emoji characters
              /:[a-z_]+:/i,                     // Slack emoji format like :smile:
              /^https?:\/\/[^\/]+\/emoji\//i    // URL path includes /emoji/
            ];
            
            // Only run the check if item.imageUrl is not null
            const isLikelyEmoji = item.imageUrl ? 
              emojiPatterns.some(pattern => pattern.test(item.imageUrl as string)) : 
              false;
            
            if (isLikelyEmoji) {
              console.log(`Detected emoji as image URL for item "${item.title}", clearing it: ${item.imageUrl}`);
              item.imageUrl = null; // Don't use emoji as image
            }
          }
        }
        
        // Post each news item individually in parallel
        for (const item of extractedContent.news) {
          // Validate image URL before sending to Slack
          const validatedImageUrl = item.imageUrl && validateImageUrl(item.imageUrl) ? item.imageUrl : null;
          
          if (item.imageUrl && !validatedImageUrl) {
            console.log(`Invalid image URL detected for "${item.title}", removing: ${item.imageUrl}`);
            item.imageUrl = null;
          }
          
          // Log accurate information about image availability
          const hasValidImage = validatedImageUrl !== null;
          console.log(`Preparing to post news item: ${item.title}, has valid image: ${hasValidImage}`);
          
          // Add to promises array
          postPromises.push(
            postToSlack({
              title: item.title,
              summary: item.content,
              url: item.url || null,
              pictureUrl: validatedImageUrl, // Use validated URL only
              audioUrl: item.audioUrl || null,
              category: 'news',
              // Don't include quiz or vocabulary
            }, channelId).then(slackResponse => {
              // Store the message ID in the item so it can be used for replies later
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
      
      // Process tools items only if there are actual items with content
      if (extractedContent.tools && extractedContent.tools.length > 0) {
        // Skip if the tools items are generic placeholders
        const hasRealToolsItems = extractedContent.tools.some(
          (item: ExtractedItem) => item.content.length >= 100 || item.url
        );
        
        if (hasRealToolsItems) {
          postPromises.push(
            processToolsItems(extractedContent.tools, channelId).then(toolsResult => {
              if (toolsResult.count > 0) {
                results.push(toolsResult);
              }
            })
          );
        } else {
          console.log('Skipping tools items as they appear to be generic placeholders');
        }
      }
      
      // Process prompts items only if there are actual items with content
      if (extractedContent.prompts && extractedContent.prompts.length > 0) {
        // Skip if the prompts items are generic placeholders
        const hasRealPromptsItems = extractedContent.prompts.some(
          (item: ExtractedItem) => item.content.length >= 100 || item.url
        );
        
        if (hasRealPromptsItems) {
          postPromises.push(
            processPromptsItems(extractedContent.prompts, channelId).then(promptsResult => {
              if (promptsResult.count > 0) {
                results.push(promptsResult);
              }
            })
          );
        } else {
          console.log('Skipping prompts items as they appear to be generic placeholders');
        }
      }
      
      // Wait for all posting operations to complete in parallel
      await Promise.all(postPromises);
      
      return res.status(200).json({
        message: 'Extracted items posted to Slack successfully',
        results,
        extractedContent // Return the updated content with message IDs
      });
    }
    
    // Handle posting vocabulary as replies to news messages
    else if (req.body.action === 'post_vocabulary_as_replies') {
      const { extractedContent } = req.body;
      
      if (!extractedContent) {
        return res.status(400).json({ error: 'Extracted content is required' });
      }
      
      const results: Array<{
        category: string;
        title?: string;
        action?: string;
        count?: number;
        slackMessageId?: string;
      }> = [];
      const postPromises = [];
      
      // First post news items (if not already posted)
      if (extractedContent.news && extractedContent.news.length > 0) {
        // For each news item that has vocabulary
        for (const item of extractedContent.news) {
          // Only process if the item has vocabulary
          if (item.vocabulary && item.vocabulary.length > 0) {
            // If the item doesn't have a slackMessageId, we need to post it first
            if (!item.slackMessageId) {
              // Validate the image URL before posting
              const validatedImageUrl = item.imageUrl && validateImageUrl(item.imageUrl) ? item.imageUrl : null;
              if (item.imageUrl && !validatedImageUrl) {
                console.log(`Removing invalid image URL before posting vocabulary reply for news item: ${item.title}`);
              }
              
              // Add to promises array to post the news item
              postPromises.push(
                postToSlack({
                  title: item.title,
                  summary: item.content,
                  url: item.url || null,
                  pictureUrl: validatedImageUrl, // Use validated URL only
                  audioUrl: item.audioUrl || null,
                  category: 'news',
                  // Do not include quiz or vocabulary in the main message
                }, channelId).then(slackResponse => {
                  // Update the item with the new slackMessageId
                  item.slackMessageId = slackResponse.ts;
                  
                  // Now post vocabulary as a reply
                  return postVocabularyAsReply(item.vocabulary!, item.slackMessageId, channelId);
                }).then(() => {
                  results.push({
                    category: 'news',
                    title: item.title,
                    action: 'vocabulary_posted_as_reply'
                  });
                })
              );
            } else {
              // The item already has a slackMessageId, just post the vocabulary as a reply
              postPromises.push(
                postVocabularyAsReply(item.vocabulary!, item.slackMessageId, channelId).then(() => {
                  results.push({
                    category: 'news',
                    title: item.title,
                    action: 'vocabulary_posted_as_reply'
                  });
                })
              );
            }
          }
        }
      }
      
      // Wait for all posting operations to complete in parallel
      await Promise.all(postPromises);
      
      return res.status(200).json({
        message: 'Vocabulary posted to Slack as replies successfully',
        results
      });
    }
    
    // Handle posting both vocabulary and quizzes as replies to news messages
    else if (req.body.action === 'post_quiz_vocab_as_replies') {
      const { extractedContent } = req.body;
      
      if (!extractedContent) {
        return res.status(400).json({ error: 'Extracted content is required' });
      }
      
      const results: Array<{
        category: string;
        title?: string;
        action?: string;
        count?: number;
        slackMessageId?: string;
      }> = [];
      const postPromises = [];
      
      // Process news items that have vocabulary or quiz
      if (extractedContent.news && extractedContent.news.length > 0) {
        for (const item of extractedContent.news) {
          // Only process if the item has vocabulary or quiz
          const hasVocabulary = item.vocabulary && item.vocabulary.length > 0;
          const hasQuiz = item.quiz && item.quiz.length > 0;
          
          if (hasVocabulary || hasQuiz) {
            // If the item doesn't have a slackMessageId, we need to post it first
            if (!item.slackMessageId) {
              // Validate the image URL before posting
              const validatedImageUrl = item.imageUrl && validateImageUrl(item.imageUrl) ? item.imageUrl : null;
              if (item.imageUrl && !validatedImageUrl) {
                console.log(`Removing invalid image URL before posting replies for news item: ${item.title}`);
              }
              
              // Add to promises array to post the news item first
              postPromises.push(
                postToSlack({
                  title: item.title,
                  summary: item.content,
                  url: item.url || null,
                  pictureUrl: validatedImageUrl, // Use validated URL only
                  audioUrl: item.audioUrl || null,
                  category: 'news',
                  // Do not include quiz or vocabulary in the main message
                }, channelId).then(async (slackResponse) => {
                  // Update the item with the new slackMessageId
                  item.slackMessageId = slackResponse.ts;
                  
                  // Post vocabulary first if available
                  if (hasVocabulary) {
                    await postVocabularyAsReply(item.vocabulary!, item.slackMessageId, channelId);
                  }
                  
                  // Then post quiz if available and save quiz data with the reply's message ID
                  if (hasQuiz) {
                    const quizReplyResponse = await postQuizAsReply(item.quiz!, item.slackMessageId, channelId);
                    
                    // Save quiz data with the quiz reply's message ID so interactions work
                    if (quizReplyResponse && quizReplyResponse.ts) {
                      await saveQuizData(item.quiz!, item.vocabulary || [], quizReplyResponse.ts);
                      console.log(`Quiz data saved for reply message ID: ${quizReplyResponse.ts}`);
                    }
                  }
                  
                  results.push({
                    category: 'news',
                    title: item.title,
                    action: 'quiz_vocab_posted_as_replies'
                  });
                })
              );
            } else {
              // The item already has a slackMessageId, just post the vocabulary and quiz as replies
              postPromises.push(
                (async () => {
                  // Post vocabulary first if available
                  if (hasVocabulary) {
                    await postVocabularyAsReply(item.vocabulary!, item.slackMessageId, channelId);
                  }
                  
                  // Then post quiz if available and save quiz data with the reply's message ID
                  if (hasQuiz) {
                    const quizReplyResponse = await postQuizAsReply(item.quiz!, item.slackMessageId, channelId);
                    
                    // Save quiz data with the quiz reply's message ID so interactions work
                    if (quizReplyResponse && quizReplyResponse.ts) {
                      await saveQuizData(item.quiz!, item.vocabulary || [], quizReplyResponse.ts);
                      console.log(`Quiz data saved for reply message ID: ${quizReplyResponse.ts}`);
                    }
                  }
                  
                  results.push({
                    category: 'news',
                    title: item.title,
                    action: 'quiz_vocab_posted_as_replies'
                  });
                })()
              );
            }
          }
        }
      }
      
      // Wait for all posting operations to complete in parallel
      await Promise.all(postPromises);
      
      return res.status(200).json({
        message: 'Vocabulary and quizzes posted to Slack as replies successfully',
        results
      });
    }
    
    // Handle posting only quizzes to Slack
    else if (req.body.action === 'post_quizzes') {
      const { extractedContent } = req.body;
      
      if (!extractedContent) {
        return res.status(400).json({ error: 'Extracted content is required' });
      }
      
      const results: Array<{
        category: string;
        title?: string;
        action?: string;
        count?: number;
        slackMessageId?: string;
      }> = [];
      const postPromises = [];
      
      // Collect all quizzes from news items
      const allQuizzes: QuizQuestion[] = [];
      
      if (extractedContent.news && extractedContent.news.length > 0) {
        for (const item of extractedContent.news) {
          if (item.quiz && item.quiz.length > 0) {
            // Add each quiz question with the source title
            item.quiz.forEach((quiz: QuizQuestion) => {
              allQuizzes.push({
                ...quiz,
                // Add source information to the question
                question: `[${item.title}] ${quiz.question}`
              });
            });
          }
        }
      }
      
      // If we have quizzes, post them as one combined quiz
      if (allQuizzes.length > 0) {
        postPromises.push(
          postQuizToSlack({
            title: "Combined Knowledge Quiz",
            summary: "Test your knowledge with these questions from recent articles!",
            url: null,
            pictureUrl: null,
            category: "quiz",
            quiz: allQuizzes
          }, channelId).then(slackResponse => {
            results.push({
              category: 'quiz',
              count: allQuizzes.length,
              slackMessageId: slackResponse.ts
            });
            
            // Save the combined quiz data
            return saveQuizData(allQuizzes, [], slackResponse.ts);
          })
        );
      }
      
      // Wait for all posting operations to complete in parallel
      await Promise.all(postPromises);
      
      return res.status(200).json({
        message: 'Quizzes posted to Slack successfully',
        results
      });
    }
    
    // Update the 'post' action to handle individual items with their quizzes and vocabulary
    else if (req.body.action === 'post') {
      const { extractedContent } = req.body;
      
      if (!extractedContent) {
        return res.status(400).json({ error: 'Extracted content is required' });
      }
      
      const results: Array<{
        category: string;
        title?: string;
        action?: string;
        count?: number;
        slackMessageId?: string;
      }> = [];
      const postPromises = [];
      
      // Process news items with their individual quiz/vocabulary
      if (extractedContent.news && extractedContent.news.length > 0) {
        // Post each news item individually in parallel
        for (const item of extractedContent.news) {
          // Validate image URL before sending to Slack
          const validatedImageUrl = item.imageUrl && validateImageUrl(item.imageUrl) ? item.imageUrl : null;
          
          if (item.imageUrl && !validatedImageUrl) {
            console.log(`Invalid image URL detected for "${item.title}", removing: ${item.imageUrl}`);
          }
          
          // Add to promises array
          postPromises.push(
            postToSlack({
              title: item.title,
              summary: item.content,
              url: item.url || null,
              pictureUrl: validatedImageUrl, // Use validated URL only
              audioUrl: item.audioUrl || null,
              category: 'news',
              quiz: item.quiz || [], // Individual quiz
              vocabulary: item.vocabulary || [] // Individual vocabulary
            }, channelId).then(slackResponse => {
              results.push({
                category: 'news',
                title: item.title,
                slackMessageId: slackResponse.ts
              });
              
              // Save quiz data for this news item
              if (item.quiz && item.vocabulary) {
                saveQuizData(
                  item.quiz,
                  item.vocabulary,
                  slackResponse.ts
                ).catch(error => {
                  console.error(`Error saving quiz data for "${item.title}":`, error);
                });
              }
            })
          );
        }
      }
      
      // Process tools items
      if (extractedContent.tools && extractedContent.tools.length > 0) {
        postPromises.push(
          processToolsItems(extractedContent.tools, channelId).then(toolsResult => {
            results.push(toolsResult);
          })
        );
      }
      
      // Process prompts items
      if (extractedContent.prompts && extractedContent.prompts.length > 0) {
        postPromises.push(
          processPromptsItems(extractedContent.prompts, channelId).then(promptsResult => {
            results.push(promptsResult);
          })
        );
      }
      
      // Wait for all posting operations to complete in parallel
      await Promise.all(postPromises);
      
      return res.status(200).json({
        message: 'Content posted to Slack successfully',
        results
      });
    }
    
    else {
      // For any other action, return an error
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error processing content:', error);
    res.status(500).json({ error: 'Failed to process content' });
  }
}

// Export utilities for external use
export { processNewsItem, saveQuizData } from '../../utils/api/quiz';
export { convertTextToSpeech } from '../../services/api/elevenlabs'; 