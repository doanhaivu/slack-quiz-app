import React, { useState, useEffect } from 'react';

interface BotConfig {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  hasToken: boolean;
  hasSecret: boolean;
}

interface BotSelectorProps {
  selectedBot: string;
  onBotChange: (botId: string) => void;
}

export const BotSelector: React.FC<BotSelectorProps> = ({ selectedBot, onBotChange }) => {
  const [bots, setBots] = useState<{ [key: string]: BotConfig }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/bots/config');
      if (response.ok) {
        const data = await response.json();
        setBots(data);
        
        // If no bot is selected and we have bots, select the first active one or default
        if (!selectedBot && Object.keys(data).length > 0) {
          const defaultBot = data.default || Object.values(data)[0] as BotConfig;
          if (defaultBot) {
            onBotChange(defaultBot.id);
          }
        }
      } else {
        setError('Failed to fetch bot configurations');
      }
    } catch (err) {
      setError('Error loading bot configurations');
      console.error('Error fetching bots:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBotChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onBotChange(event.target.value);
  };

  if (loading) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px',
        padding: '8px 12px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        Loading bots...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px',
        padding: '8px 12px',
        backgroundColor: '#ffebee',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#c62828'
      }}>
        {error}
      </div>
    );
  }

  const activeBots = Object.entries(bots).filter(([, bot]) => bot.isActive && bot.hasToken && bot.hasSecret);

  if (activeBots.length === 0) {
    return (
      <div style={{ 
        position: 'absolute', 
        top: '20px', 
        right: '20px',
        padding: '8px 12px',
        backgroundColor: '#fff3e0',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#e65100'
      }}>
        No configured bots available
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'absolute', 
      top: '20px', 
      right: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      fontSize: '14px'
    }}>
      <span>Using bot:</span>
      <select 
        value={selectedBot} 
        onChange={handleBotChange}
        style={{
          padding: '4px 8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: 'white',
          fontSize: '14px',
          minWidth: '150px'
        }}
      >
        {activeBots.map(([botId, bot]) => (
          <option key={botId} value={botId}>
            {bot.name}
          </option>
        ))}
      </select>
    </div>
  );
}; 