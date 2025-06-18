import { NextApiRequest, NextApiResponse } from 'next';
import { getSlackClient } from '../../../services/slack/client';
import { lunchOrders } from './schedule';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, event } = req.body;

    // Handle Slack URL verification challenge
    if (req.body.challenge) {
      return res.status(200).json({ challenge: req.body.challenge });
    }

    // Only handle reaction events
    if (type === 'event_callback' && 
        (event.type === 'reaction_added' || event.type === 'reaction_removed')) {
      
      // Only process pizza reactions
      if (event.reaction === 'pizza') {
        await handleLunchReaction(event);
      }
    }

    return res.status(200).json({ message: 'Event processed' });
  } catch (error) {
    console.error('Error handling lunch reaction:', error);
    return res.status(500).json({ error: 'Failed to process reaction' });
  }
}

interface SlackReactionEvent {
  type: string;
  user: string;
  reaction: string;
  item: {
    type: string;
    channel: string;
    ts: string;
  };
}

async function handleLunchReaction(event: SlackReactionEvent) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todaysOrders = lunchOrders.get(today);

    if (!todaysOrders || todaysOrders.messageTs !== event.item.ts) {
      // This reaction is not for today's lunch message
      return;
    }

    const slack = getSlackClient();
    
    // Get user info
    const userInfo = await slack.users.info({ user: event.user });
    const username = userInfo.user?.real_name || userInfo.user?.name || 'Unknown User';

    if (event.type === 'reaction_added') {
      // Add user to orders if not already present
      const existingOrderIndex = todaysOrders.orders.findIndex(order => order.userId === event.user);
      
      if (existingOrderIndex === -1) {
        todaysOrders.orders.push({
          userId: event.user,
          username: username,
          timestamp: new Date().toISOString()
        });
      }
    } else if (event.type === 'reaction_removed') {
      // Remove user from orders
      todaysOrders.orders = todaysOrders.orders.filter(order => order.userId !== event.user);
    }

    // Update the message with new order list
    await updateLunchMessage(event.item.channel, todaysOrders);

  } catch (error) {
    console.error('Error handling lunch reaction:', error);
  }
}

interface LunchOrderData {
  messageTs?: string;
  date: string;
  orders: {
    userId: string;
    username: string;
    timestamp: string;
  }[];
  scheduledTime: string;
}

async function updateLunchMessage(channelId: string, orderData: LunchOrderData) {
  const slack = getSlackClient();
  
  const ordersList = orderData.orders.length > 0 
    ? orderData.orders.map((order) => `• ${order.username}`).join('\n')
    : '_No orders yet..._';

  const totalOrders = orderData.orders.length;
  const deadline = orderData.scheduledTime === "09:30" ? "11:00 AM" : "12:00 PM";

  try {
    if (!orderData.messageTs) {
      console.error('No messageTs found for order data');
      return;
    }

    await slack.chat.update({
      channel: channelId,
      ts: orderData.messageTs,
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
            })}*\n\n🍕 React with :pizza: to order lunch!\n\n*Orders so far:*\n${ordersList}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⏰ Deadline: ${deadline} | 📊 Total orders: ${totalOrders}`
            }
          ]
        }
      ]
    });

    console.log(`✅ Updated lunch message: ${totalOrders} orders`);
  } catch (error) {
    console.error('Error updating lunch message:', error);
  }
} 