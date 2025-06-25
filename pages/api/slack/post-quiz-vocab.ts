import { NextApiRequest, NextApiResponse } from 'next';
import { SLACK_CHANNEL_ID } from '../../../constants';
import { postToSlack, postVocabularyAsReply, postQuizAsReply } from '../../../services/slack';
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
    const { extractedContent, channelId } = req.body;
    
    if (!extractedContent) {
      return res.status(400).json({ error: 'Extracted content is required' });
    }
    
    const targetChannelId = channelId || SLACK_CHANNEL_ID;
    
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
                pictureUrl: validatedImageUrl,
                audioUrl: item.audioUrl || null,
                category: 'news',
                // Do not include quiz or vocabulary in the main message
              }, targetChannelId).then(async (slackResponse) => {
                // Update the item with the new slackMessageId
                item.slackMessageId = slackResponse.ts;
                
                // Post vocabulary first if available
                if (hasVocabulary) {
                  await postVocabularyAsReply(item.vocabulary!, item.slackMessageId, targetChannelId);
                }
                
                // Then post quiz if available and save quiz data
                if (hasQuiz) {
                  const quizReplyResponse = await postQuizAsReply(item.quiz!, item.slackMessageId, targetChannelId);
                  
                  // Save quiz data with the quiz reply's message ID
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
                  await postVocabularyAsReply(item.vocabulary!, item.slackMessageId, targetChannelId);
                }
                
                // Then post quiz if available and save quiz data
                if (hasQuiz) {
                  const quizReplyResponse = await postQuizAsReply(item.quiz!, item.slackMessageId, targetChannelId);
                  
                  // Save quiz data with the quiz reply's message ID
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
    
    // Wait for all posting operations to complete
    await Promise.all(postPromises);
    
    return res.status(200).json({
      message: 'Quiz and vocabulary posted as replies successfully',
      results
    });
  } catch (error) {
    console.error('Error posting quiz/vocab replies:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
} 