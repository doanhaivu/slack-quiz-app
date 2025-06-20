import { NextApiRequest, NextApiResponse } from 'next';
import { getSlackClientForBot } from '../../../services/slack/client';
import { SLACK_CHANNEL_ID } from '../../../constants';

interface LunchOrderData {
  messageTs?: string;
  date: string;
  channelId: string;
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
    const { channelId = SLACK_CHANNEL_ID, scheduledTime = "09:30", botId } = req.body;
    
    console.log(`📤 Posting lunch message - Channel: ${channelId}, Bot: ${botId || 'default'}`);
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const slack = getSlackClientForBot(botId);

    // First, let's verify the bot can access the channel
    try {
      const channelInfo = await slack.conversations.info({ channel: channelId });
      console.log(`✅ Channel found: ${channelInfo.channel?.name} (${channelId})`);
    } catch (channelError) {
      console.error(`❌ Channel access error for ${channelId}:`, channelError);
      return res.status(400).json({ 
        error: `Channel not found or bot doesn't have access to channel ${channelId}. Make sure the bot is added to the channel.`,
        channelId,
        botId: botId || 'default'
      });
    }

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
              text: `⏰ Deadline: ${scheduledTime === "09:30" ? "10:30 AM" : "11:30 AM"} | 📊 Total orders: 0`
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
      channelId: channelId,
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
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('channel_not_found')) {
        return res.status(400).json({ 
          error: `Channel not found. Please check if the bot is added to the channel and the channel ID is correct.`,
          details: error.message,
          channelId: req.body.channelId,
          botId: req.body.botId || 'default'
        });
      }
      if (error.message.includes('not_in_channel')) {
        return res.status(400).json({ 
          error: `Bot is not in the channel. Please add the bot to the channel first.`,
          details: error.message,
          channelId: req.body.channelId,
          botId: req.body.botId || 'default'
        });
      }
      if (error.message.includes('missing_scope')) {
        return res.status(400).json({ 
          error: `Bot doesn't have required permissions. Check OAuth scopes.`,
          details: error.message,
          botId: req.body.botId || 'default'
        });
      }
    }
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to post lunch message',
      channelId: req.body.channelId,
      botId: req.body.botId || 'default'
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