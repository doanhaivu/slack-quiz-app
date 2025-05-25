import fs from 'fs/promises';
import { ExtractedItem, QuizQuestion, VocabularyItem } from '../../types';
import { generateQuizAndVocabulary } from '../../services/api/openai';

/**
 * Process a news item to add quiz and vocabulary
 * 
 * @param newsItem The news item to process
 * @returns The processed news item with quiz and vocabulary
 */
export async function processNewsItem(newsItem: ExtractedItem): Promise<ExtractedItem> {
  console.log(`Processing news item: ${newsItem.title}`);
  
  // Combined generation of quiz and vocabulary for news items in one API call
  const contentText = `Title: ${newsItem.title}\nContent: ${newsItem.content}`;
  const combinedQuizVocab = await generateQuizAndVocabulary(contentText);
  
  // Update the item with quiz and vocabulary
  newsItem.quiz = combinedQuizVocab.quiz;
  newsItem.vocabulary = combinedQuizVocab.vocabulary;
  
  // Audio is now generated during the extraction phase, not here
  return newsItem;
}

/**
 * Save quiz data to a file
 * 
 * @param quiz The quiz questions
 * @param vocabulary The vocabulary items
 * @param slackMessageId The Slack message ID
 */
export async function saveQuizData(
  quiz: QuizQuestion[], 
  vocabulary: VocabularyItem[],
  slackMessageId?: string
): Promise<string> {
  try {
    // Ensure directories exist
    await fs.mkdir('./data', { recursive: true });
    await fs.mkdir('./data/quizzes', { recursive: true });
    
    // Create quiz entry
    const quizEntry = {
      date: new Date().toISOString(),
      quiz,
      vocabulary,
      slackMessageId // Add the slack message ID to enable matching
    };
    
    // Save as an individual file
    const timestamp = new Date().getTime();
    const safeId = slackMessageId ? slackMessageId.replace('.', '_') : 'unknown';
    const filename = `./data/quizzes/quiz_${timestamp}_${safeId}.json`;
    
    await fs.writeFile(
      filename,
      JSON.stringify(quizEntry, null, 2)
    );
    
    console.log('Quiz saved as individual file:', filename);
    return filename;
  } catch (error) {
    console.error('Error saving quiz file:', error);
    throw error;
  }
} 