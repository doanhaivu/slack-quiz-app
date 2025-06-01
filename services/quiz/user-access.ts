import { getSlackClient } from '../slack/client';

/**
 * Check whether multiple users have access to the quiz app
 * This function can be used to check if permissions might be causing the single-user issue
 */
export async function checkSlackUsersAccess(): Promise<{
  hasToken: boolean;
  botInfo: Record<string, unknown> | null;
  error?: string;
}> {
  try {
    // Check if we have a bot token
    if (!process.env.SLACK_BOT_TOKEN) {
      return { hasToken: false, botInfo: null, error: 'No SLACK_BOT_TOKEN found in environment' };
    }
    
    const slack = getSlackClient();
    // Get bot info to check if the token is valid
    const response = await slack.auth.test();
    
    return {
      hasToken: true,
      botInfo: {
        botId: response.bot_id,
        userId: response.user_id,
        teamId: response.team_id,
        teamName: response.team,
        isEnterpriseInstall: response.enterprise_id ? true : false,
        scopes: process.env.SLACK_SCOPES || 'unknown'
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { 
      hasToken: !!process.env.SLACK_BOT_TOKEN, 
      botInfo: null, 
      error: `Error checking Slack access: ${errorMessage}` 
    };
  }
} 