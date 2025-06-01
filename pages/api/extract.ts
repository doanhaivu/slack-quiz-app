import { NextApiRequest, NextApiResponse } from 'next';
import { extractItemsFromText, saveExtractedItems } from '../../utils/api/extract';
import { processNewsItem } from '../../utils/api/quiz';
import { ServerLogger } from '../../utils/api/server-logger';

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
    console.log('Starting content extraction process');
    const { text, images, urls } = req.body;
    
    if ((!text || typeof text !== 'string') && (!images || !images.length) && (!urls || !urls.length)) {
      console.log('No content provided for extraction');
      const logs = serverLogger.stop();
      return res.status(400).json({ error: 'Text, images, or URLs are required', logs });
    }

    console.log('Calling extraction function');
    // Extract items from the provided content
    const extractedItems = await extractItemsFromText(text || '', urls || [], images || []);
    
    console.log('Received extraction results:', extractedItems.length, 'items found');
    
    if (!extractedItems.length) {
      console.log('No items extracted from text');
      const logs = serverLogger.stop();
      return res.status(400).json({ error: 'No news, tools, or prompts found in the text', logs });
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
    const logs = serverLogger.stop();
    return res.status(200).json({
      message: 'Content extracted successfully',
      extractedContent: categorizedItems,
      logs
    });
    
  } catch (error) {
    console.error('Error during extraction:', error);
    const logs = serverLogger.stop();
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Extraction failed', 
      logs 
    });
  }
} 