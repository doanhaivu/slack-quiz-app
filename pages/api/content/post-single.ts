import { NextApiRequest, NextApiResponse } from 'next';
import { SLACK_CHANNEL_ID } from '../../../constants';
import { postToSlack } from '../../../services/slack';
import { processToolsItems, processPromptsItems } from '../../../utils/api/items';
import { saveQuizData } from '../../../utils/api/quiz';
import { validateImageUrl } from '../../../utils/api/validation';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, item, channelId } = req.body;
    
    if (!category || !item) {
      return res.status(400).json({ error: 'Category and item are required' });
    }
    
    const targetChannelId = channelId || SLACK_CHANNEL_ID;
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
      }, targetChannelId);
      
      // Save quiz data if available
      if (item.quiz && item.vocabulary) {
        await saveQuizData(
          item.quiz,
          item.vocabulary,
          slackResponse.ts || ''
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
      const toolsResponse = await processToolsItems([item], targetChannelId);
      result = toolsResponse;
    }
    else if (category === 'prompts') {
      // Post a single prompt item
      const promptsResponse = await processPromptsItems([item], targetChannelId);
      result = promptsResponse;
    }
    
    return res.status(200).json({
      message: 'Item posted to Slack successfully',
      result
    });
  } catch (error) {
    console.error('Error posting single item:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
} 