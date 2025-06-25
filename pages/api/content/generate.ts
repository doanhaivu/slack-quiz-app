import { NextApiRequest, NextApiResponse } from 'next';
import { ServerLogger } from '../../../utils/api/server-logger';
import { processNewsItem } from '../../../utils/api/quiz';
import { ExtractedItem } from '../../../types';

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
    const { item } = req.body;
    
    if (!item || typeof item !== 'object') {
      console.log('Invalid item provided for generation');
      const logs = serverLogger.stop();
      return res.status(400).json({ error: 'Item is required', logs });
    }

    console.log('Generating quiz and vocabulary for an individual item');
    
    let result: ExtractedItem;
    
    if (item.category === 'news') {
      // Generate quiz and vocabulary for news item
      result = await processNewsItem(item);
    } else {
      // For tools and prompts, just return the item as is - no generation needed
      result = item;
    }
    
    console.log('Item processed successfully');
    const logs = serverLogger.stop();
    
    return res.status(200).json({
      message: 'Item processed successfully',
      item: result,
      logs
    });
  } catch (error) {
    console.error('Error in content generation:', error);
    const logs = serverLogger.stop();
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      logs
    });
  }
} 