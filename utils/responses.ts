import fs from 'fs/promises';
import path from 'path';
import { WebClient } from '@slack/web-api';

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

interface QuizResponse {
  userId: string;
  quizId: string;
  questionIndex: number;
  question: string;
  answer: string;
  isCorrect: boolean;
  timestamp: string;
}

interface UserScore {
  userId: string;
  username: string;
  score: number;
  totalAnswered: number;
  correctAnswers: number;
  accuracy: number;
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
 * Calculate user scores based on quiz responses
 */
export async function calculateUserScores(): Promise<UserScore[]> {
  const responses = await getAllResponses();
  
  // Create a map to track first attempts per user per question
  const userFirstAttempts = new Map<string, Set<string>>();
  const userScores = new Map<string, UserScore>();
  
  // Process responses in chronological order
  const sortedResponses = [...responses].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (const response of sortedResponses) {
    const { userId, quizId, questionIndex, isCorrect } = response;
    
    // Create unique key for this question
    const questionKey = `${quizId}_${questionIndex}`;
    
    // Check if this is the first attempt for this user on this question
    if (!userFirstAttempts.has(userId)) {
      userFirstAttempts.set(userId, new Set());
    }
    
    const userAttempts = userFirstAttempts.get(userId)!;
    
    // Skip if not first attempt
    if (userAttempts.has(questionKey)) {
      continue;
    }
    
    // Mark as attempted
    userAttempts.add(questionKey);
    
    // Update user scores
    if (!userScores.has(userId)) {
      userScores.set(userId, {
        userId,
        username: userId, // Will be updated later
        score: 0,
        totalAnswered: 0,
        correctAnswers: 0,
        accuracy: 0
      });
    }
    
    const userScore = userScores.get(userId)!;
    userScore.totalAnswered += 1;
    
    if (isCorrect) {
      userScore.score += 1;
      userScore.correctAnswers += 1;
    }
    
    userScore.accuracy = (userScore.correctAnswers / userScore.totalAnswered) * 100;
  }
  
  // Convert map to array
  const scoresArray = Array.from(userScores.values());
  
  // Sort by score (highest first)
  scoresArray.sort((a, b) => b.score - a.score);
  
  // Try to get usernames from Slack
  try {
    for (const score of scoresArray) {
      try {
        const userInfo = await slack.users.info({ user: score.userId });
        if (userInfo.user && userInfo.user.real_name) {
          score.username = userInfo.user.real_name;
        } else if (userInfo.user && userInfo.user.name) {
          score.username = userInfo.user.name;
        }
      } catch (error) {
        console.error(`Could not get username for ${score.userId}:`, error);
        // Keep using user ID if we can't get the username
      }
    }
  } catch (error) {
    console.error('Error getting usernames:', error);
  }
  
  return scoresArray;
}

/**
 * Get detailed quiz statistics
 */
export async function getQuizStatistics() {
  const responses = await getAllResponses();
  
  // Track first attempts only
  const firstAttempts = new Map<string, Map<string, QuizResponse>>();
  
  // Process responses in chronological order
  const sortedResponses = [...responses].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  for (const response of sortedResponses) {
    const { userId, quizId, questionIndex } = response;
    
    // Create unique key for this question
    const questionKey = `${quizId}_${questionIndex}`;
    
    // Create user map if not exists
    if (!firstAttempts.has(userId)) {
      firstAttempts.set(userId, new Map());
    }
    
    const userAttempts = firstAttempts.get(userId)!;
    
    // Only record first attempt
    if (!userAttempts.has(questionKey)) {
      userAttempts.set(questionKey, response);
    }
  }
  
  // Analyze quiz difficulty by question
  const questionStats = new Map<string, { 
    attempts: number, 
    correct: number, 
    question: string,
    quizId: string,
    questionIndex: number
  }>();
  
  // Process all first attempts
  for (const userMap of firstAttempts.values()) {
    for (const response of userMap.values()) {
      const { quizId, questionIndex, question, isCorrect } = response;
      const key = `${quizId}_${questionIndex}`;
      
      if (!questionStats.has(key)) {
        questionStats.set(key, { 
          attempts: 0, 
          correct: 0, 
          question,
          quizId,
          questionIndex
        });
      }
      
      const stats = questionStats.get(key)!;
      stats.attempts += 1;
      if (isCorrect) {
        stats.correct += 1;
      }
    }
  }
  
  // Convert to array and calculate percentages
  const questionStatsArray = Array.from(questionStats.values()).map(stat => ({
    ...stat,
    correctPercentage: stat.attempts > 0 ? (stat.correct / stat.attempts) * 100 : 0
  }));
  
  // Sort by difficulty (easiest first)
  questionStatsArray.sort((a, b) => b.correctPercentage - a.correctPercentage);
  
  return {
    totalResponses: responses.length,
    uniqueUsers: firstAttempts.size,
    questionStats: questionStatsArray
  };
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
    } catch (error) {
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
 * Check whether multiple users have access to the quiz app
 * This function can be used to check if permissions might be causing the single-user issue
 */
export async function checkSlackUsersAccess(): Promise<{
  hasToken: boolean;
  botInfo: Record<string, unknown> | null;
  error?: string;
}> {
  try {
    // Check if we have a bot token
    if (!process.env.SLACK_BOT_TOKEN) {
      return { hasToken: false, botInfo: null, error: 'No SLACK_BOT_TOKEN found in environment' };
    }
    
    // Get bot info to check if the token is valid
    const response = await slack.auth.test();
    
    return {
      hasToken: true,
      botInfo: {
        botId: response.bot_id,
        userId: response.user_id,
        teamId: response.team_id,
        teamName: response.team,
        isEnterpriseInstall: response.enterprise_id ? true : false,
        scopes: process.env.SLACK_SCOPES || 'unknown'
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { 
      hasToken: !!process.env.SLACK_BOT_TOKEN, 
      botInfo: null, 
      error: `Error checking Slack access: ${errorMessage}` 
    };
  }
} 