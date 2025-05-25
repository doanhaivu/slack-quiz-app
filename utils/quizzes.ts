import fs from 'fs/promises';
import path from 'path';

interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

interface VocabularyItem {
  term: string;
  definition: string;
}

interface Quiz {
  date?: string;
  timestamp?: string;
  slackMessageId?: string;
  quiz: QuizQuestion[];
  vocabulary?: VocabularyItem[];
  title?: string;
  summary?: string;
  url?: string | null;
  pictureUrl?: string | null;
  category?: string;
}

/**
 * Get all quizzes from individual files in the data/quizzes directory
 */
export async function getAllQuizzes(): Promise<Quiz[]> {
  const quizDir = path.join(process.cwd(), 'data', 'quizzes');
  let files: string[];
  
  try {
    files = await fs.readdir(quizDir);
  } catch (error) {
    console.error('Error reading quizzes directory:', error);
    return [];
  }
  
  const quizzes: Quiz[] = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(quizDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      const quiz = JSON.parse(content) as Quiz;
      quizzes.push(quiz);
    } catch (error) {
      console.error(`Error reading quiz file ${file}:`, error);
    }
  }
  
  // Sort by date (newest first)
  return quizzes.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });
}

/**
 * Get a quiz by its Slack message ID
 */
export async function getQuizBySlackMessageId(messageId: string): Promise<Quiz | null> {
  const quizDir = path.join(process.cwd(), 'data', 'quizzes');
  let files: string[];
  
  try {
    files = await fs.readdir(quizDir);
  } catch (error) {
    console.error('Error reading quizzes directory:', error);
    return null;
  }
  
  const safeMessageId = messageId.replace('.', '_');
  
  for (const file of files) {
    if (file.includes(safeMessageId)) {
      try {
        const filePath = path.join(quizDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content) as Quiz;
      } catch (error) {
        console.error(`Error reading quiz file ${file}:`, error);
        return null;
      }
    }
  }
  
  return null;
} 