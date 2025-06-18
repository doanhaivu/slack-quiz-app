import { NextApiRequest, NextApiResponse } from 'next';
import { getSlackClient } from '../../../services/slack/client';
import { SLACK_CHANNEL_ID } from '../../../constants';
import { lunchOrders } from './schedule';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    return await handleGetSummary(req, res);
  } else if (req.method === 'POST') {
    return await handleSendReminder(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Shared function to get lunch summary data
async function getLunchSummaryData(date?: string) {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const orderData = lunchOrders.get(targetDate);
  
  if (!orderData) {
    throw new Error(`No lunch orders found for date: ${targetDate}`);
  }

  // Get channel members to identify who hasn't ordered
  const slack = getSlackClient();
  const channelInfo = await slack.conversations.members({
    channel: SLACK_CHANNEL_ID // Note: This should be made dynamic based on the order data
  });

  const orderedUserIds = new Set(orderData.orders.map(order => order.userId));
  const allMembers = channelInfo.members || [];
  
  // Filter out bots and get info for members who haven't ordered
  const nonOrderedMembers = [];
  for (const memberId of allMembers) {
    if (!orderedUserIds.has(memberId)) {
      try {
        const userInfo = await slack.users.info({ user: memberId });
        // Skip bots and deleted users
        if (!userInfo.user?.is_bot && !userInfo.user?.deleted) {
          nonOrderedMembers.push({
            userId: memberId,
            username: userInfo.user?.real_name || userInfo.user?.name || 'Unknown User'
          });
        }
      } catch (error) {
        console.error(`Error getting user info for ${memberId}:`, error);
      }
    }
  }

  return {
    date: targetDate,
    summary: {
      totalOrders: orderData.orders.length,
      totalMembers: allMembers.length,
      orderedUsers: orderData.orders,
      nonOrderedUsers: nonOrderedMembers,
      orderingRate: Math.round((orderData.orders.length / allMembers.length) * 100)
    }
  };
}

async function handleGetSummary(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { date } = req.query;
    const summaryData = await getLunchSummaryData(date as string);
    return res.status(200).json(summaryData);
  } catch (error) {
    console.error('Error getting lunch summary:', error);
    if (error instanceof Error && error.message.includes('No lunch orders found')) {
      return res.status(404).json({
        error: error.message,
        date: (req.query.date as string) || new Date().toISOString().split('T')[0]
      });
    }
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get lunch summary'
    });
  }
}

async function handleSendReminder(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { channelId = SLACK_CHANNEL_ID, messageType = 'gentle' } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const orderData = lunchOrders.get(today);
    
    if (!orderData) {
      return res.status(404).json({
        error: 'No lunch orders found for today'
      });
    }

    const slack = getSlackClient();
    
    // Get summary data directly instead of making HTTP request
    const summary = await getLunchSummaryData(today);
    const nonOrderedUsers = summary.summary.nonOrderedUsers;

    if (nonOrderedUsers.length === 0) {
      return res.status(200).json({
        message: 'Everyone has already ordered lunch!',
        totalOrders: summary.summary.totalOrders
      });
    }

    // Create reminder message
    const reminderMessages = {
      gentle: {
        text: "🍽️ Lunch Order Reminder",
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🍽️ *Lunch Order Reminder*\n\nHey team! Just a friendly reminder that lunch orders are still open.\n\n📊 *Current Status:*\n• ${summary.summary.totalOrders} people have ordered\n• ${nonOrderedUsers.length} people haven't ordered yet\n\nDon't forget to react with 🍕 on today's lunch message if you want to order!`
            }
          }
        ]
      },
      urgent: {
        text: "🚨 Last Call for Lunch Orders!",
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🚨 *Last Call for Lunch Orders!*\n\nTime is running out to place your lunch order!\n\n*Still waiting on:*\n${nonOrderedUsers.map((user: { username: string }) => `• ${user.username}`).join('\n')}\n\nPlease react with 🍕 on today's lunch message ASAP!`
            }
          }
        ]
      }
    };

    const messageConfig = reminderMessages[messageType as keyof typeof reminderMessages] || reminderMessages.gentle;

    await slack.chat.postMessage({
      channel: channelId,
      text: messageConfig.text,
      blocks: messageConfig.blocks
    });

    return res.status(200).json({
      message: 'Reminder sent successfully',
      reminderType: messageType,
      nonOrderedCount: nonOrderedUsers.length,
      nonOrderedUsers: nonOrderedUsers.map((user: { username: string }) => user.username)
    });

  } catch (error) {
    console.error('Error sending lunch reminder:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send reminder'
    });
  }
} 