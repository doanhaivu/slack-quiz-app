import { useState, useEffect } from 'react';

interface ChannelSelectorProps {
  selectedChannel: string;
  onChannelChange: (channelId: string) => void;
}

interface SlackChannel {
  id: string;
  name: string;
}

const ChannelSelector: React.FC<ChannelSelectorProps> = ({ 
  selectedChannel, 
  onChannelChange 
}) => {
  const [channels, setChannels] = useState<SlackChannel[]>([
    { id: 'C08ST272AAG', name: '#default-channel' }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load channels from API - would require backend support
    // For now we just have a static list with the default channel
    const fetchChannels = async () => {
      try {
        setLoading(true);
        // Fetch channels from API
        // const response = await fetch('/api/slack/channels');
        // if (response.ok) {
        //   const data = await response.json();
        //   setChannels(data.channels);
        // } else {
          // Fallback to hardcoded channels if API fails
          setChannels([
            { id: 'C08ST272AAG', name: '#test-bot' },
            { id: 'C08NFUBLJN9', name: '#english-club' },
          ]);
        // }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching channels:', error);
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  return (
    <div style={{ 
      position: 'absolute', 
      top: '20px', 
      right: '20px',
      display: 'flex',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      padding: '5px 10px',
      borderRadius: '5px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <label htmlFor="channel-select" style={{ marginRight: '10px', fontSize: '14px' }}>
        Post to:
      </label>
      <select
        id="channel-select"
        value={selectedChannel}
        onChange={(e) => onChannelChange(e.target.value)}
        disabled={loading}
        style={{
          padding: '5px 10px',
          borderRadius: '4px',
          border: '1px solid #ddd',
          backgroundColor: 'white',
          minWidth: '150px'
        }}
      >
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.name}
          </option>
        ))}
      </select>
      {loading && <span style={{ marginLeft: '10px', fontSize: '12px' }}>Loading...</span>}
    </div>
  );
};

export default ChannelSelector; 