export interface UserScore {
  userId: string;
  username: string;
  score: number;
  totalAnswered: number;
  correctAnswers: number;
  accuracy: number;
}

export interface QuestionStat {
  attempts: number;
  correct: number;
  question: string;
  quizId: string;
  questionIndex: number;
  correctPercentage: number;
}

export interface QuizStats {
  totalResponses: number;
  uniqueUsers: number;
  questionStats: QuestionStat[];
}

export interface ReportData {
  userScores: UserScore[];
  quizStats: QuizStats;
  availableWeeks: string[];
  currentWeek: string;
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