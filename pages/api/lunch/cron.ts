import { NextApiRequest, NextApiResponse } from 'next';
import { getSlackClient } from '../../../services/slack/client';
import { SLACK_CHANNEL_ID } from '../../../constants';
import { lunchOrders } from './schedule';

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

    // Post today's lunch message directly instead of making HTTP request
    const result = await postLunchMessage(SLACK_CHANNEL_ID, "09:30");

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

async function postLunchMessage(channelId: string, scheduledTime: string = "09:30") {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const slack = getSlackClient();

  // Create the lunch order message
  const message = await slack.chat.postMessage({
    channel: channelId,
    text: "🍽️ Daily Lunch Order - React with 🍕 to order!",
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🍽️ Daily Lunch Order'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📅 *${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}*\n\n🍕 React with :pizza: to order lunch!\n\n*Orders so far:*\n_No orders yet..._`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `⏰ Deadline: ${scheduledTime === "09:30" ? "11:00 AM" : "12:00 PM"} | 📊 Total orders: 0`
          }
        ]
      }
    ]
  });

  // Add pizza reaction to the message to make it clear
  if (message.ts) {
    await slack.reactions.add({
      channel: channelId,
      timestamp: message.ts,
      name: 'pizza'
    });
  }

  // Store the order data
  lunchOrders.set(today, {
    messageTs: message.ts,
    date: today,
    orders: [],
    scheduledTime
  });

  return {
    messageTs: message.ts,
    date: today
  };
} 