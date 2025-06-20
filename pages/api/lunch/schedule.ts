import { NextApiRequest, NextApiResponse } from 'next';
import { getSlackClient } from '../../../services/slack/client';
import { SLACK_CHANNEL_ID } from '../../../constants';

interface LunchOrderData {
  messageTs?: string;
  date: string;
  orders: {
    userId: string;
    username: string;
    timestamp: string;
  }[];
  scheduledTime: string; // Format: "09:30" for 9:30 AM
}

// In a real app, this would be stored in a database
// For now, we'll use a simple in-memory store
const lunchOrders: Map<string, LunchOrderData> = new Map();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    return await handlePostLunchMessage(req, res);
  } else if (req.method === 'GET') {
    return await handleGetTodaysOrders(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handlePostLunchMessage(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { channelId = SLACK_CHANNEL_ID, scheduledTime = "09:30" } = req.body;
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const slack = getSlackClient();

    // Create the lunch order message
    const message = await slack.chat.postMessage({
      channel: channelId,
      text: "🍽️ Daily Lunch Order - React with ✅ to order or ❌ for no order!",
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
            })}*\n\n✅ React with :white_check_mark: to order lunch!\n❌ React with :x: if you're not ordering\n\n*Orders so far (0):*\n_No orders yet..._`
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

    // Add checkmark and cross reactions to the message to make it clear
    if (message.ts) {
      await slack.reactions.add({
        channel: channelId,
        timestamp: message.ts,
        name: 'white_check_mark'
      });
      await slack.reactions.add({
        channel: channelId,
        timestamp: message.ts,
        name: 'x'
      });
    }

    // Store the order data
    lunchOrders.set(today, {
      messageTs: message.ts,
      date: today,
      orders: [],
      scheduledTime
    });

    return res.status(200).json({
      message: 'Lunch order message posted successfully',
      messageTs: message.ts,
      date: today
    });

  } catch (error) {
    console.error('Error posting lunch message:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to post lunch message' 
    });
  }
}

async function handleGetTodaysOrders(req: NextApiRequest, res: NextApiResponse) {
  const today = new Date().toISOString().split('T')[0];
  const todaysOrders = lunchOrders.get(today);

  if (!todaysOrders) {
    return res.status(404).json({ 
      error: 'No lunch orders found for today',
      date: today 
    });
  }

  return res.status(200).json({
    date: today,
    orders: todaysOrders.orders,
    totalOrders: todaysOrders.orders.length,
    messageTs: todaysOrders.messageTs
  });
}

export { lunchOrders }; 