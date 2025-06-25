import { NextApiRequest, NextApiResponse } from 'next';
import { SLACK_CHANNEL_ID } from '../../../constants';
import { ExtractedItem } from '../../../types';
import { ServerLogger } from '../../../utils/api/server-logger';
import { processNewsItem, saveQuizData } from '../../../utils/api/quiz';
import { processToolsItems, processPromptsItems } from '../../../utils/api/items';
import { postToSlack } from '../../../services/slack';
import { validateImageUrl } from '../../../utils/api/validation';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Start server-side logging
  const serverLogger = new ServerLogger();
  serverLogger.start();

  try {
    const { extractedContent, channelId } = req.body;
    
    if (!extractedContent) {
      const logs = serverLogger.stop();
      return res.status(400).json({ error: 'Extracted content is required', logs });
    }
    
    const targetChannelId = channelId || SLACK_CHANNEL_ID;
    console.log(`Using Slack channel ID: ${targetChannelId}`);
    
    const results: Array<{
      category: string;
      title?: string;
      slackMessageId?: string;
      count?: number;
      action?: string;
    }> = [];
    
    const postPromises = [];
    
    // Process and post news items with quiz and vocabulary
    if (extractedContent.news && extractedContent.news.length > 0) {
      for (const item of extractedContent.news) {
        // Ensure quiz and vocabulary are generated
        const processedItem = item.quiz && item.vocabulary ? item : await processNewsItem(item);
        
        // Validate image URL
        const validatedImageUrl = processedItem.imageUrl && validateImageUrl(processedItem.imageUrl) 
          ? processedItem.imageUrl : null;
        
        if (processedItem.imageUrl && !validatedImageUrl) {
          console.log(`Removing invalid image URL for news item: ${processedItem.title}`);
        }
        
        postPromises.push(
          postToSlack({
            title: processedItem.title,
            summary: processedItem.content,
            url: processedItem.url || null,
            pictureUrl: validatedImageUrl,
            audioUrl: processedItem.audioUrl || null,
            category: 'news',
            quiz: processedItem.quiz || [],
            vocabulary: processedItem.vocabulary || []
          }, targetChannelId).then(async (slackResponse) => {
            // Save quiz data if available
            if (processedItem.quiz && processedItem.vocabulary && slackResponse.ts) {
              await saveQuizData(
                processedItem.quiz,
                processedItem.vocabulary,
                slackResponse.ts
              );
            }
            
            results.push({
              category: 'news',
              title: processedItem.title,
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
      }
    }
    
    // Wait for all posting operations to complete
    await Promise.all(postPromises);
    
    const logs = serverLogger.stop();
    
    return res.status(200).json({
      message: 'Content posted to Slack successfully',
      results,
      logs
    });
  } catch (error) {
    console.error('Error posting to Slack:', error);
    const logs = serverLogger.stop();
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      logs
    });
  }
} 