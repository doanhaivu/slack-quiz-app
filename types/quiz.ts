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
  improvementTrend: number;
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

export interface QuizStats {
  totalResponses: number;
  uniqueUsers: number;
  questionStats: QuestionStat[];
}

export interface PronunciationStats {
  totalAttempts: number;
  uniqueThreads: number;
  totalUsers: number;
  overallAverageScore: number;
  threadStats: PronunciationStat[];
}

export interface ReportData {
  userScores: UserScore[];
  quizStats: QuizStats;
  availableWeeks: string[];
  currentWeek: string;
  pronunciation: {
    userScores: UserPronunciationScore[];
    stats: PronunciationStats;
    availableWeeks: string[];
  };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

export interface VocabularyItem {
  term: string;
  definition: string;
} 