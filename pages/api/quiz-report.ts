import { NextApiRequest, NextApiResponse } from 'next';
import { calculateUserScores, getQuizStatistics, getAvailableWeeks, calculateUserPronunciationScores, getPronunciationStatistics } from '../../services/quiz';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { week } = req.query;
    const weekFilter = typeof week === 'string' ? week : undefined;
    
    // Get available weeks
    const availableWeeks = await getAvailableWeeks();
    
    // Get user scores (with optional week filter)
    const userScores = await calculateUserScores(weekFilter);
    
    // Get quiz statistics (with optional week filter)
    const quizStats = await getQuizStatistics(weekFilter);
    
    // Get pronunciation statistics (no week filter for now - could be added later)
    const pronunciationUserScores = await calculateUserPronunciationScores();
    const pronunciationStats = await getPronunciationStatistics();
    
    return res.status(200).json({
      userScores,
      quizStats,
      availableWeeks,
      currentWeek: weekFilter || 'all',
      pronunciation: {
        userScores: pronunciationUserScores,
        stats: pronunciationStats
      }
    });
  } catch (error) {
    console.error('Error generating quiz report:', error);
    return res.status(500).json({ error: 'Failed to generate quiz report' });
  }
} 