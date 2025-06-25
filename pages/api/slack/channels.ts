import { NextApiRequest, NextApiResponse } from 'next';
import { getSlackClient } from '../../../services/slack/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const slack = getSlackClient();
    
    // Get list of public channels
    const channelsResponse = await slack.conversations.list({
      types: 'public_channel',
      exclude_archived: true,
      limit: 100
    });

    if (!channelsResponse.ok) {
      throw new Error('Failed to fetch channels from Slack');
    }

    const channels = channelsResponse.channels?.map(channel => ({
      id: channel.id,
      name: `#${channel.name}`
    })) || [];

    // Sort channels alphabetically by name
    channels.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      channels: channels
    });

  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch channels'
    });
  }
} 