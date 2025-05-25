import { ExtractedItem } from '../../types';
import { WebClient } from '@slack/web-api';
import { SLACK_CHANNEL_ID } from '../../constants';

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

/**
 * Process tools items for posting to Slack
 * 
 * @param toolsItems The tools items to process
 * @param channelId The Slack channel ID
 * @returns The result of processing tools items
 */
export async function processToolsItems(
  toolsItems: ExtractedItem[], 
  channelId: string = SLACK_CHANNEL_ID
) {
  // Skip if no actual tools items
  if (!toolsItems || toolsItems.length === 0) {
    console.log('No tools items to process');
    return {
      category: 'tools',
      count: 0
    };
  }

  // Create a combined message with all tools
  const toolsListText = toolsItems.map(item => 
    `*${item.title}*\n${item.content}${item.url ? `\n<${item.url}|Check it out>` : ''}`
  ).join('\n\n');
  
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🛠️ *Awesome AI Tools Roundup!* 🚀`
      }
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: toolsListText
      }
    }
  ];
  
  const response = await slack.chat.postMessage({
    channel: channelId,
    blocks,
    text: `New AI tools roundup`, // Fallback text
  });
  
  return {
    category: 'tools',
    count: toolsItems.length,
    slackMessageId: response.ts
  };
}

/**
 * Process prompts items for posting to Slack
 * 
 * @param promptsItems The prompts items to process
 * @param channelId The Slack channel ID
 * @returns The result of processing prompts items
 */
export async function processPromptsItems(
  promptsItems: ExtractedItem[], 
  channelId: string = SLACK_CHANNEL_ID
) {
  // Skip if no actual prompts items
  if (!promptsItems || promptsItems.length === 0) {
    console.log('No prompts items to process');
    return {
      category: 'prompts',
      count: 0
    };
  }

  // Create a combined message with all prompts
  const promptsListText = promptsItems.map(item => 
    `*${item.title}*\n${item.content}${item.url ? `\n<${item.url}|See example>` : ''}`
  ).join('\n\n');
  
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✨ *Magical AI Prompts Collection* 💬`
      }
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: promptsListText
      }
    }
  ];
  
  const response = await slack.chat.postMessage({
    channel: channelId,
    blocks,
    text: `New AI prompts collection`, // Fallback text
  });
  
  return {
    category: 'prompts',
    count: promptsItems.length,
    slackMessageId: response.ts
  };
} 