import { NextApiRequest, NextApiResponse } from 'next';
import { calculateUserScores, getQuizStatistics } from '../../utils/responses';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user scores
    const userScores = await calculateUserScores();
    
    // Get quiz statistics
    const quizStats = await getQuizStatistics();
    
    return res.status(200).json({
      userScores,
      quizStats
    });
  } catch (error) {
    console.error('Error generating quiz report:', error);
    return res.status(500).json({ error: 'Failed to generate quiz report' });
  }
} 