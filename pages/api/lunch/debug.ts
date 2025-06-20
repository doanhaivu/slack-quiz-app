import { NextApiRequest, NextApiResponse } from 'next';
import { getSlackClientForBot } from '../../../services/slack/client';

interface DebugResult {
  botId: string;
  timestamp: string;
  botInfo?: {
    userId?: string;
    teamId?: string;
    botId?: string;
    teamName?: string;
  };
  authError?: string;
  channelInfo?: {
    id?: string;
    name?: string;
    isPrivate?: boolean;
    isMember?: boolean;
    memberCount?: number;
  };
  channelError?: string;
  memberCount?: number;
  botInChannel?: boolean;
  memberListError?: string;
  accessibleChannels?: Array<{
    id?: string;
    name?: string;
    isPrivate?: boolean;
    isMember?: boolean;
  }>;
  listError?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { botId, channelId } = req.query;
    const slack = getSlackClientForBot(botId as string);

    console.log(`🔍 Debug request - Bot: ${botId || 'default'}, Channel: ${channelId || 'all'}`);

    const result: DebugResult = {
      botId: typeof botId === 'string' ? botId : 'default',
      timestamp: new Date().toISOString()
    };

    // Test bot authentication
    try {
      const authTest = await slack.auth.test();
      result.botInfo = {
        userId: authTest.user_id,
        teamId: authTest.team_id,
        botId: authTest.bot_id,
        teamName: authTest.team
      };
      console.log(`✅ Bot authenticated: ${authTest.user} in ${authTest.team}`);
    } catch (authError) {
      console.error('❌ Bot authentication failed:', authError);
      result.authError = authError instanceof Error ? authError.message : 'Auth failed';
      return res.status(400).json(result);
    }

    // If specific channel requested, test access to it
    if (channelId) {
      try {
        const channelInfo = await slack.conversations.info({ channel: channelId as string });
        result.channelInfo = {
          id: channelInfo.channel?.id,
          name: channelInfo.channel?.name,
          isPrivate: channelInfo.channel?.is_private,
          isMember: channelInfo.channel?.is_member,
          memberCount: channelInfo.channel?.num_members
        };
        console.log(`✅ Channel access verified: #${channelInfo.channel?.name}`);

        // Try to get channel members
        try {
          const members = await slack.conversations.members({ channel: channelId as string });
          result.memberCount = members.members?.length || 0;
          result.botInChannel = (result.botInfo?.userId && members.members?.includes(result.botInfo.userId)) || false;
          console.log(`✅ Channel members: ${result.memberCount}, Bot in channel: ${result.botInChannel}`);
        } catch (memberError) {
          console.log('⚠️ Could not get member list (might be normal for public channels)');
          result.memberListError = memberError instanceof Error ? memberError.message : 'Could not get members';
        }

      } catch (channelError) {
        console.error(`❌ Channel access failed for ${channelId}:`, channelError);
        result.channelError = channelError instanceof Error ? channelError.message : 'Channel access failed';
      }
    } else {
      // List accessible channels
      try {
        const channels = await slack.conversations.list({ 
          types: 'public_channel,private_channel',
          limit: 100
        });
        result.accessibleChannels = channels.channels?.map(ch => ({
          id: ch.id,
          name: ch.name,
          isPrivate: ch.is_private,
          isMember: ch.is_member
        })) || [];
        console.log(`✅ Found ${result.accessibleChannels.length} accessible channels`);
      } catch (listError) {
        console.error('❌ Could not list channels:', listError);
        result.listError = listError instanceof Error ? listError.message : 'Could not list channels';
      }
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Debug failed',
      botId: req.query.botId || 'default'
    });
  }
} 