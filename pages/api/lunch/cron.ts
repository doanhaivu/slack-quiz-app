import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the request is from a trusted source (optional security)
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current time and check if it's a weekday
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(200).json({ 
        message: 'Skipped lunch order for weekend',
        date: now.toISOString().split('T')[0]
      });
    }

    // Call the schedule endpoint to post today's lunch message
    const scheduleResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/lunch/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledTime: "09:30" // Default to 9:30 AM
      })
    });

    if (!scheduleResponse.ok) {
      const error = await scheduleResponse.text();
      throw new Error(`Failed to schedule lunch message: ${error}`);
    }

    const result = await scheduleResponse.json();

    return res.status(200).json({
      message: 'Daily lunch order posted successfully',
      ...result
    });

  } catch (error) {
    console.error('Error in lunch cron job:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to execute cron job'
    });
  }
} 