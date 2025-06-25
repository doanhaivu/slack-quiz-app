import { getSlackClientForBot } from './client';
import { lunchOrders } from '../../pages/api/lunch/schedule';

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

interface LunchOrderData {
  messageTs?: string;
  date: string;
  channelId: string;
  botId: string;
  orders: {
    userId: string;
    username: string;
    timestamp: string;
  }[];
  scheduledTime: string;
}

export async function handleLunchReaction(event: SlackReactionEvent): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todaysOrders = lunchOrders.get(today);

    if (!todaysOrders || todaysOrders.messageTs !== event.item.ts) {
      // This reaction is not for today's lunch message
      return;
    }

    const slackClient = getSlackClientForBot(todaysOrders.botId);
    
    console.log(`🔄 Handling lunch reaction - Using bot: ${todaysOrders.botId}, Channel: ${event.item.channel}`);
    
    // Get all reactions on the message to determine user's actual status
    const messageReactions = await slackClient.reactions.get({
      channel: event.item.channel,
      timestamp: event.item.ts
    });

    // Get user info
    const userInfo = await slackClient.users.info({ user: event.user });
    const username = userInfo.user?.real_name || userInfo.user?.name || 'Unknown User';

    // Check if user has both checkmark and cross reactions
    const reactions = messageReactions.message?.reactions || [];
    const userHasCheckmark = reactions.find((r: { name?: string; users?: string[] }) => r.name === 'white_check_mark')?.users?.includes(event.user) || false;
    const userHasCross = reactions.find((r: { name?: string; users?: string[] }) => r.name === 'x')?.users?.includes(event.user) || false;

    // Determine if user should be in orders list
    // If user has both reactions, cross takes priority (they don't want to order)
    const shouldOrder = userHasCheckmark && !userHasCross;

    const existingOrderIndex = todaysOrders.orders.findIndex(order => order.userId === event.user);

    if (shouldOrder) {
      // Add user to orders if not already present
      if (existingOrderIndex === -1) {
        todaysOrders.orders.push({
          userId: event.user,
          username: username,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      // Remove user from orders if present
      if (existingOrderIndex !== -1) {
        todaysOrders.orders = todaysOrders.orders.filter(order => order.userId !== event.user);
      }
    }

    // Update the message with new order list
    await updateLunchMessage(event.item.channel, todaysOrders);

  } catch (error) {
    console.error('Error handling lunch reaction:', error);
  }
}

export async function updateLunchMessage(channelId: string, orderData: LunchOrderData): Promise<void> {
  const slackClient = getSlackClientForBot(orderData.botId);
  
  console.log(`📝 Updating lunch message - Bot: ${orderData.botId}, Channel: ${channelId}, Orders: ${orderData.orders.length}`);
  
  const ordersList = orderData.orders.length > 0 
    ? orderData.orders.map((order) => `• ${order.username}`).join('\n')
    : '_No orders yet..._';

  const totalOrders = orderData.orders.length;
  const deadline = orderData.scheduledTime === "09:30" ? "10:30 AM" : "11:30 AM";

  try {
    if (!orderData.messageTs) {
      console.error('No messageTs found for order data');
      return;
    }

    await slackClient.chat.update({
      channel: channelId,
      ts: orderData.messageTs,
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
            })}*\n\n✅ React with :white_check_mark: to order lunch!\n❌ React with :x: if you're not ordering\n\n*Orders so far (${totalOrders}):*\n${ordersList}`
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