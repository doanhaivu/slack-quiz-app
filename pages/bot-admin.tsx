import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import ProtectedRoute from '../components/ProtectedRoute';

interface BotConfig {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  hasToken: boolean;
  hasSecret: boolean;
}

const BotAdminPage: NextPage = () => {
  const [bots, setBots] = useState<{ [key: string]: BotConfig }>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBot, setNewBot] = useState({
    name: '',
    botToken: '',
    signingSecret: ''
  });

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bots/config');
      if (response.ok) {
        const data = await response.json();
        setBots(data);
      } else {
        setMessage('Error fetching bot configurations');
      }
    } catch (error) {
      setMessage('Error fetching bot configurations');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBot.name || !newBot.botToken || !newBot.signingSecret) {
      setMessage('All fields are required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/bots/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBot)
      });

      if (response.ok) {
        setMessage('Bot added successfully!');
        setNewBot({ name: '', botToken: '', signingSecret: '' });
        setShowAddForm(false);
        fetchBots();
      } else {
        const error = await response.json();
        setMessage(error.error || 'Error adding bot');
      }
    } catch (error) {
      setMessage('Error adding bot');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (botId === 'default') {
      setMessage('Cannot delete default bot');
      return;
    }

    if (!confirm('Are you sure you want to delete this bot configuration?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/bots/config?id=${botId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setMessage('Bot deleted successfully!');
        fetchBots();
      } else {
        const error = await response.json();
        setMessage(error.error || 'Error deleting bot');
      }
    } catch (error) {
      setMessage('Error deleting bot');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Head>
        <title>Bot Configuration Admin</title>
      </Head>
      
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui' }}>
        <h1>🤖 Bot Configuration Admin</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => fetchBots()}
            disabled={loading}
            style={{
              padding: '10px 20px',
              marginRight: '10px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            🔄 Refresh
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007cba',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ➕ Add Bot
          </button>
        </div>

        {message && (
          <div style={{ 
            padding: '10px', 
            marginBottom: '20px', 
            backgroundColor: message.toLowerCase().includes('error') ? '#f8d7da' : '#d4edda', 
            border: `1px solid ${message.toLowerCase().includes('error') ? '#f5c6cb' : '#c3e6cb'}`,
            borderRadius: '4px'
          }}>
            {message}
          </div>
        )}

        {showAddForm && (
          <div style={{ 
            padding: '20px', 
            marginBottom: '20px', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6',
            borderRadius: '4px' 
          }}>
            <h3>Add New Bot</h3>
            <form onSubmit={handleAddBot}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Bot Name:
                </label>
                <input
                  type="text"
                  value={newBot.name}
                  onChange={(e) => setNewBot({ ...newBot, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="e.g., Production Bot"
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Bot Token:
                </label>
                <input
                  type="password"
                  value={newBot.botToken}
                  onChange={(e) => setNewBot({ ...newBot, botToken: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="xoxb-..."
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Signing Secret:
                </label>
                <input
                  type="password"
                  value={newBot.signingSecret}
                  onChange={(e) => setNewBot({ ...newBot, signingSecret: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                  placeholder="Your signing secret"
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  marginRight: '10px',
                  backgroundColor: '#007cba',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                💾 Save Bot
              </button>
              
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        <div>
          <h2>📋 Bot Configurations</h2>
          {loading ? (
            <p>Loading...</p>
          ) : Object.keys(bots).length === 0 ? (
            <p>No bot configurations found.</p>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {Object.entries(bots).map(([botId, bot]) => (
                <div
                  key={botId}
                  style={{
                    padding: '15px',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: bot.isActive ? '#f8f9fa' : '#e9ecef'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0' }}>
                        {bot.name}
                        {botId === 'default' && <span style={{ fontSize: '12px', color: '#6c757d' }}> (Default)</span>}
                      </h3>
                      <div style={{ fontSize: '14px', color: '#6c757d' }}>
                        <div>ID: {bot.id}</div>
                        <div>Created: {new Date(bot.createdAt).toLocaleDateString()}</div>
                        <div>
                          Status: 
                          <span style={{ 
                            color: bot.isActive ? '#28a745' : '#dc3545',
                            marginLeft: '5px'
                          }}>
                            {bot.isActive ? '✅ Active' : '❌ Inactive'}
                          </span>
                        </div>
                        <div>
                          Configuration: 
                          <span style={{ 
                            color: (bot.hasToken && bot.hasSecret) ? '#28a745' : '#dc3545',
                            marginLeft: '5px'
                          }}>
                            {(bot.hasToken && bot.hasSecret) ? '✅ Complete' : '❌ Incomplete'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {botId !== 'default' && (
                      <button
                        onClick={() => handleDeleteBot(botId)}
                        disabled={loading}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default BotAdminPage; 