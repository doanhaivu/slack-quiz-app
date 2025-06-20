import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface BotConfig {
  id: string;
  name: string;
  botToken: string;
  signingSecret: string;
  isActive: boolean;
  createdAt: string;
}

interface BotConfigs {
  [key: string]: BotConfig;
}

interface PublicBotConfig {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  hasToken: boolean;
  hasSecret: boolean;
}

interface PublicBotConfigs {
  [key: string]: PublicBotConfig;
}

const BOT_CONFIG_PATH = path.join(process.cwd(), 'data', 'bot-configs.json');

function loadBotConfigs(): BotConfigs {
  try {
    if (!fs.existsSync(BOT_CONFIG_PATH)) {
      const defaultConfigs: BotConfigs = {
        default: {
          id: 'default',
          name: 'Default Bot',
          botToken: process.env.SLACK_BOT_TOKEN || '',
          signingSecret: process.env.SLACK_SIGNING_SECRET || '',
          isActive: true,
          createdAt: new Date().toISOString()
        }
      };
      saveBotConfigs(defaultConfigs);
      return defaultConfigs;
    }
    
    const data = fs.readFileSync(BOT_CONFIG_PATH, 'utf8');
    const configs = JSON.parse(data);
    
    // Ensure default bot exists with environment variables
    if (!configs.default) {
      configs.default = {
        id: 'default',
        name: 'Default Bot',
        botToken: process.env.SLACK_BOT_TOKEN || '',
        signingSecret: process.env.SLACK_SIGNING_SECRET || '',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      saveBotConfigs(configs);
    }
    
    return configs;
  } catch (error) {
    console.error('Error loading bot configs:', error);
    return {};
  }
}

function saveBotConfigs(configs: BotConfigs): void {
  try {
    const dir = path.dirname(BOT_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BOT_CONFIG_PATH, JSON.stringify(configs, null, 2));
  } catch (error) {
    console.error('Error saving bot configs:', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    return await handleGetConfigs(req, res);
  } else if (req.method === 'POST') {
    return await handleCreateConfig(req, res);
  } else if (req.method === 'PUT') {
    return await handleUpdateConfig(req, res);
  } else if (req.method === 'DELETE') {
    return await handleDeleteConfig(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetConfigs(req: NextApiRequest, res: NextApiResponse) {
  try {
    const configs = loadBotConfigs();
    
    // Return configs without sensitive data for listing
    const publicConfigs = Object.entries(configs).reduce((acc, [key, config]) => {
      acc[key] = {
        id: config.id,
        name: config.name,
        isActive: config.isActive,
        createdAt: config.createdAt,
        hasToken: !!config.botToken,
        hasSecret: !!config.signingSecret
      };
      return acc;
    }, {} as PublicBotConfigs);
    
    return res.status(200).json(publicConfigs);
  } catch (error) {
    console.error('Error getting bot configs:', error);
    return res.status(500).json({ error: 'Failed to get bot configurations' });
  }
}

async function handleCreateConfig(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { name, botToken, signingSecret } = req.body;
    
    if (!name || !botToken || !signingSecret) {
      return res.status(400).json({ error: 'Name, bot token, and signing secret are required' });
    }
    
    const configs = loadBotConfigs();
    const id = `bot_${Date.now()}`;
    
    configs[id] = {
      id,
      name,
      botToken,
      signingSecret,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    saveBotConfigs(configs);
    
    return res.status(201).json({
      id,
      name,
      isActive: true,
      createdAt: configs[id].createdAt,
      hasToken: true,
      hasSecret: true
    });
  } catch (error) {
    console.error('Error creating bot config:', error);
    return res.status(500).json({ error: 'Failed to create bot configuration' });
  }
}

async function handleUpdateConfig(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id, name, botToken, signingSecret, isActive } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Bot ID is required' });
    }
    
    const configs = loadBotConfigs();
    
    if (!configs[id]) {
      return res.status(404).json({ error: 'Bot configuration not found' });
    }
    
    // Update only provided fields
    if (name !== undefined) configs[id].name = name;
    if (botToken !== undefined) configs[id].botToken = botToken;
    if (signingSecret !== undefined) configs[id].signingSecret = signingSecret;
    if (isActive !== undefined) configs[id].isActive = isActive;
    
    saveBotConfigs(configs);
    
    return res.status(200).json({
      id: configs[id].id,
      name: configs[id].name,
      isActive: configs[id].isActive,
      createdAt: configs[id].createdAt,
      hasToken: !!configs[id].botToken,
      hasSecret: !!configs[id].signingSecret
    });
  } catch (error) {
    console.error('Error updating bot config:', error);
    return res.status(500).json({ error: 'Failed to update bot configuration' });
  }
}

async function handleDeleteConfig(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Bot ID is required' });
    }
    
    if (id === 'default') {
      return res.status(400).json({ error: 'Cannot delete default bot configuration' });
    }
    
    const configs = loadBotConfigs();
    
    if (!configs[id]) {
      return res.status(404).json({ error: 'Bot configuration not found' });
    }
    
    delete configs[id];
    saveBotConfigs(configs);
    
    return res.status(200).json({ message: 'Bot configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting bot config:', error);
    return res.status(500).json({ error: 'Failed to delete bot configuration' });
  }
}

export { loadBotConfigs, type BotConfig, type BotConfigs }; 