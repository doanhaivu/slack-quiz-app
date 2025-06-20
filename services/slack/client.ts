import { WebClient } from '@slack/web-api';
import { loadBotConfigs } from '../../pages/api/bots/config';

// Initialize Slack client singleton
let slackClient: WebClient | null = null;
const botClients: { [botId: string]: WebClient } = {}; // Cache for bot clients

/**
 * Get or create the Slack Web API client
 * @returns Configured Slack WebClient instance
 */
export function getSlackClient(): WebClient {
  if (!slackClient) {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN environment variable is not set');
    }
    slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return slackClient;
}

/**
 * Get Slack client for a specific bot configuration
 * @param botId The bot configuration ID to use
 * @returns Configured Slack WebClient instance for the specified bot
 */
export function getSlackClientForBot(botId?: string): WebClient {
  if (!botId) {
    return getSlackClient(); // Return default client if no bot ID provided
  }
  
  // Return cached client if available
  if (botClients[botId]) {
    return botClients[botId];
  }
  
  try {
    const configs = loadBotConfigs();
    const botConfig = configs[botId];
    
    if (!botConfig || !botConfig.isActive || !botConfig.botToken) {
      console.warn(`Bot ${botId} not found or inactive, using default bot`);
      return getSlackClient();
    }
    
    // Create and cache the client
    botClients[botId] = new WebClient(botConfig.botToken);
    return botClients[botId];
  } catch (error) {
    console.error(`Error loading bot ${botId}, using default:`, error);
    return getSlackClient();
  }
}

/**
 * Reset the Slack client (useful for testing)
 */
export function resetSlackClient(): void {
  slackClient = null;
  // Clear bot client cache
  Object.keys(botClients).forEach(key => delete botClients[key]);
} 