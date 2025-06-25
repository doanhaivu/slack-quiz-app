import { getSlackClient } from '../slack/client';
import { QuizResponse, getAllResponses, filterResponsesByWeek } from './response-manager';
import { PronunciationResponseData } from './index';
import fs from 'fs/promises';
import path from 'path';

export interface UserScore {
  userId: string;
  username: string;
  score: number;
  totalAnswered: number;
  correctAnswers: number;
  accuracy: number;
}

export interface UserPronunciationScore {
  userId: string;
  username: string;
  averageScore: number;
  bestScore: number;
  totalAttempts: number;
  improvementTrend: number; // Difference between first and latest score
}

export interface QuestionStat {
  attempts: number;
  correct: number;
  question: string;
  quizId: string;
  questionIndex: number;
  correctPercentage: number;
}

export interface PronunciationStat {
  threadId: string;
  originalText: string;
  attempts: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
}

/**
 * Get all pronunciation responses
 */
async function getAllPronunciationResponses(): Promise<PronunciationResponseData[]> {
  try {
    const responsesPath = path.join(process.cwd(), 'data', 'pronunciation-responses.json');
    const data = await fs.readFile(responsesPath, 'utf8');
    return JSON.parse(data) || [];
  } catch {
    return [];
  }
}

/**
 * Calculate user pronunciation scores
 */
export async function calculateUserPronunciationScores(): Promise<UserPronunciationScore[]> {
  const allResponses = await getAllPronunciationResponses();
  
  // Group responses by user
  const userResponsesMap = new Map<string, PronunciationResponseData[]>();
  
  for (const response of allResponses) {
    if (!userResponsesMap.has(response.userId)) {
      userResponsesMap.set(response.userId, []);
    }
    userResponsesMap.get(response.userId)!.push(response);
  }
  
  const userScores: UserPronunciationScore[] = [];
  
  for (const [userId, responses] of userResponsesMap.entries()) {
    // Sort by timestamp to get chronological order
    const sortedResponses = responses.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const scores = sortedResponses.map(r => r.score);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const bestScore = Math.max(...scores);
    const improvementTrend = scores.length > 1 ? scores[scores.length - 1] - scores[0] : 0;
    
    userScores.push({
      userId,
      username: userId, // Will be updated later with real names
      averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal
      bestScore,
      totalAttempts: responses.length,
      improvementTrend: Math.round(improvementTrend * 10) / 10
    });
  }
  
  // Sort by average score (highest first)
  userScores.sort((a, b) => b.averageScore - a.averageScore);
  
  // Try to get usernames from Slack
  try {
    const slack = getSlackClient();
    for (const score of userScores) {
      try {
        const userInfo = await slack.users.info({ user: score.userId });
        if (userInfo.user && userInfo.user.real_name) {
          score.username = userInfo.user.real_name;
        } else if (userInfo.user && userInfo.user.name) {
          score.username = userInfo.user.name;
        }
      } catch (error) {
        console.error(`Could not get username for ${score.userId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error getting usernames:', error);
  }
  
  return userScores;
}

/**
 * Get pronunciation statistics by thread/content
 */
export async function getPronunciationStatistics() {
  const allResponses = await getAllPronunciationResponses();
  
  // Group by thread ID
  const threadStatsMap = new Map<string, PronunciationResponseData[]>();
  
  for (const response of allResponses) {
    if (!threadStatsMap.has(response.threadId)) {
      threadStatsMap.set(response.threadId, []);
    }
    threadStatsMap.get(response.threadId)!.push(response);
  }
  
  const threadStats: PronunciationStat[] = [];
  
  for (const [threadId, responses] of threadStatsMap.entries()) {
    const scores = responses.map(r => r.score);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    
    // Get original text from any response (should be same for all in thread)
    const originalText = responses[0].originalText;
    
    threadStats.push({
      threadId,
      originalText: originalText.substring(0, 100) + (originalText.length > 100 ? '...' : ''),
      attempts: responses.length,
      averageScore: Math.round(averageScore * 10) / 10,
      bestScore,
      worstScore
    });
  }
  
  // Sort by average score (lowest first to show most challenging content)
  threadStats.sort((a, b) => a.averageScore - b.averageScore);
  
  return {
    totalAttempts: allResponses.length,
    uniqueThreads: threadStatsMap.size,
    totalUsers: new Set(allResponses.map(r => r.userId)).size,
    overallAverageScore: allResponses.length > 0 
      ? Math.round((allResponses.reduce((sum, r) => sum + r.score, 0) / allResponses.length) * 10) / 10
      : 0,
    threadStats
  };
}

/**
 * Calculate user scores based on quiz responses
 */
export async function calculateUserScores(weekFilter?: string): Promise<UserScore[]> {
  const allResponses = await getAllResponses();
  const responses = filterResponsesByWeek(allResponses, weekFilter);
  
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
    const slack = getSlackClient();
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
export async function getQuizStatistics(weekFilter?: string) {
  const allResponses = await getAllResponses();
  const responses = filterResponsesByWeek(allResponses, weekFilter);
  
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
  const questionStatsArray: QuestionStat[] = Array.from(questionStats.values()).map(stat => ({
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