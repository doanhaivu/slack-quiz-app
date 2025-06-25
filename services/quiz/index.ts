// Re-export all quiz services for clean imports

// Type exports
export type { QuizResponse } from './response-manager';
export type { UserScore, QuestionStat } from './statistics';

// Function exports
export {
  getAllResponses,
  saveQuizResponse,
  getWeekRange,
  getAvailableWeeks,
  filterResponsesByWeek
} from './response-manager';

export {
  calculateUserScores,
  getQuizStatistics
} from './statistics';

export {
  checkSlackUsersAccess
} from './user-access';

// Pronunciation response functionality
import fs from 'fs/promises';
import path from 'path';

export interface PronunciationResponseData {
  userId: string;
  threadId: string;
  originalText: string;
  transcribedText: string;
  score: number;
  feedback: string;
  timestamp: string;
}

export async function savePronunciationResponse(responseData: PronunciationResponseData): Promise<boolean> {
  try {
    const responsesPath = path.join(process.cwd(), 'data', 'pronunciation-responses.json');
    
    // Read existing responses or create empty array
    let responses: PronunciationResponseData[] = [];
    try {
      const data = await fs.readFile(responsesPath, 'utf8');
      responses = JSON.parse(data) || [];
    } catch {
      // File doesn't exist or is empty - start with empty array
    }
    
    // Remove any existing response from this user for this thread (override behavior)
    responses = responses.filter(r => 
      !(r.userId === responseData.userId && r.threadId === responseData.threadId)
    );
    
    // Add the new response
    responses.push(responseData);
    
    // Write back to file
    await fs.writeFile(responsesPath, JSON.stringify(responses, null, 2));
    
    console.log('✅ Pronunciation response saved (overriding any previous attempt)');
    return true;
  } catch (error) {
    console.error('Error saving pronunciation response:', error);
    throw error;
  }
} 