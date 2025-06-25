import fs from 'fs/promises';
import path from 'path';

export interface QuizResponse {
  userId: string;
  quizId: string;
  questionIndex: number;
  question: string;
  answer: string;
  isCorrect: boolean;
  timestamp: string;
}

/**
 * Get all quiz responses
 */
export async function getAllResponses(): Promise<QuizResponse[]> {
  const responsesPath = path.join(process.cwd(), 'data', 'responses.json');
  
  try {
    const data = await fs.readFile(responsesPath, 'utf8');
    return JSON.parse(data) as QuizResponse[];
  } catch (error) {
    console.error('Error reading responses file:', error);
    return [];
  }
}

/**
 * Save a new quiz response, only if it's the first attempt
 */
export async function saveQuizResponse(response: QuizResponse): Promise<boolean> {
  try {
    console.log(`🔍 QUIZ RESPONSE: Attempting to save response from user ${response.userId} for quiz ${response.quizId}, question ${response.questionIndex}`);
    
    // Make sure we have a valid user ID
    if (!response.userId) {
      console.error('❌ QUIZ DEBUG: Missing user ID in response data');
      return false;
    }
    
    // Make sure the data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    const responsesPath = path.join(dataDir, 'responses.json');
    let existingResponses: QuizResponse[] = [];
    
    try {
      const responsesData = await fs.readFile(responsesPath, 'utf8');
      existingResponses = JSON.parse(responsesData.toString() || '[]');
      console.log(`📊 QUIZ DEBUG: Found ${existingResponses.length} existing responses`);
      
      // Display stats about unique users in existing responses
      const uniqueUsers = new Set(existingResponses.map(r => r.userId));
      console.log(`📊 QUIZ DEBUG: Found ${uniqueUsers.size} unique users in responses: ${Array.from(uniqueUsers).join(', ')}`);
    } catch {
      console.log('📝 QUIZ DEBUG: No previous responses found - creating new file');
      // If the file doesn't exist, we'll create it when we save
    }
    
    // Double-check we actually have a valid user ID
    console.log(`🔍 QUIZ DEBUG: User ID from response: '${response.userId}'`);
    
    // Check if this user has already answered this question
    const matchingResponses = existingResponses.filter(r => 
      r.userId === response.userId && 
      r.quizId === response.quizId && 
      r.questionIndex === response.questionIndex
    );
    
    const hasExistingResponse = matchingResponses.length > 0;
    
    if (hasExistingResponse) {
      console.log(`🔎 QUIZ DEBUG: User ${response.userId} has already answered this question. Existing response:`, matchingResponses[0]);
    } else {
      console.log(`🔎 QUIZ DEBUG: User ${response.userId} has not answered this question yet`);
    }
    
    // Check if any responses exist for this question from other users
    const otherUserResponses = existingResponses.filter(r => 
      r.userId !== response.userId && 
      r.quizId === response.quizId && 
      r.questionIndex === response.questionIndex
    );
    
    if (otherUserResponses.length > 0) {
      console.log(`🔎 QUIZ DEBUG: Found ${otherUserResponses.length} responses to this question from other users:`, 
        otherUserResponses.map(r => ({ userId: r.userId, isCorrect: r.isCorrect })));
    } else {
      console.log(`🔎 QUIZ DEBUG: No other users have answered this question`);
    }
    
    // Only save if this is the first attempt
    if (!hasExistingResponse) {
      existingResponses.push(response);
      await fs.writeFile(responsesPath, JSON.stringify(existingResponses, null, 2));
      console.log('✅ QUIZ DEBUG: Response saved successfully (first attempt)');
      return true;
    } else {
      console.log('⏩ QUIZ DEBUG: Skipping save - not first attempt');
      return false;
    }
  } catch (error) {
    console.error('❌ QUIZ DEBUG: Error saving response:', error);
    return false;
  }
}

/**
 * Extract timestamp from quizId (same format as Slack threadId)
 */
function getTimestampFromQuizId(quizId: string): Date {
  // QuizId format is like "1748150546.942729" where first part is Unix timestamp in seconds
  const timestampSeconds = parseFloat(quizId.split('.')[0]);
  return new Date(timestampSeconds * 1000);
}

/**
 * Get the start and end dates for a given week string (e.g., "2024-01-15")
 */
export function getWeekRange(weekString: string): { start: Date, end: Date } {
  const date = new Date(weekString);
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day); // Go to Sunday
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Go to Saturday
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Get available weeks from responses based on quiz posting time (quizId)
 */
export async function getAvailableWeeks(): Promise<string[]> {
  const responses = await getAllResponses();
  
  if (responses.length === 0) {
    return [];
  }
  
  // Get unique weeks from quizId timestamps (original quiz posting time)
  const weeks = new Set<string>();
  
  for (const response of responses) {
    const originalDate = getTimestampFromQuizId(response.quizId);
    const sunday = new Date(originalDate);
    sunday.setDate(originalDate.getDate() - originalDate.getDay()); // Go to Sunday
    const weekString = sunday.toISOString().split('T')[0]; // YYYY-MM-DD format
    weeks.add(weekString);
  }
  
  // Sort weeks in descending order (newest first)
  return Array.from(weeks).sort((a, b) => b.localeCompare(a));
}

/**
 * Filter responses by week based on quiz posting time (quizId)
 */
export function filterResponsesByWeek(responses: QuizResponse[], weekString?: string): QuizResponse[] {
  if (!weekString || weekString === 'all') {
    return responses;
  }
  
  const { start, end } = getWeekRange(weekString);
  
  return responses.filter(response => {
    const originalDate = getTimestampFromQuizId(response.quizId);
    return originalDate >= start && originalDate <= end;
  });
} 