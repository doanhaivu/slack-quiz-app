import { WebClient } from '@slack/web-api';

// Initialize Slack client singleton
let slackClient: WebClient | null = null;

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
 * Reset the Slack client (useful for testing)
 */
export function resetSlackClient(): void {
  slackClient = null;
} 