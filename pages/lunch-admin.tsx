import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import ChannelSelector from '../components/ChannelSelector';
import { SLACK_CHANNEL_ID } from '../constants';

interface LunchSummary {
  date: string;
  summary: {
    totalOrders: number;
    totalMembers: number;
    orderedUsers: { userId: string; username: string; timestamp: string }[];
    nonOrderedUsers: { userId: string; username: string }[];
    orderingRate: number;
  };
}

const LunchAdminPage: NextPage = () => {
  const [summary, setSummary] = useState<LunchSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(SLACK_CHANNEL_ID);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lunch/summary');
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      } else {
        setMessage('No lunch orders found for today');
      }
    } catch (error) {
      setMessage('Error fetching lunch summary');
      console.error(error);
    }
    setLoading(false);
  };

  const postLunchMessage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lunch/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scheduledTime: '09:30',
          channelId: selectedChannel 
        })
      });
      
      if (response.ok) {
        setMessage('Lunch message posted successfully!');
        setTimeout(fetchSummary, 1000); // Refresh summary after posting
      } else {
        setMessage('Error posting lunch message');
      }
    } catch (error) {
      setMessage('Error posting lunch message');
      console.error(error);
    }
    setLoading(false);
  };

  const sendReminder = async (type: 'gentle' | 'urgent') => {
    setLoading(true);
    try {
      const response = await fetch('/api/lunch/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messageType: type,
          channelId: selectedChannel 
        })
      });
      
      if (response.ok) {
        setMessage(`${type === 'gentle' ? 'Gentle' : 'Urgent'} reminder sent!`);
      } else {
        setMessage('Error sending reminder');
      }
    } catch (error) {
      setMessage('Error sending reminder');
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <>
      <Head>
        <title>Lunch Order Admin</title>
      </Head>
      
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui', position: 'relative' }}>
        <h1>🍽️ Lunch Order Admin</h1>
        
        <ChannelSelector
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
        />
        
        {message && (
          <div style={{ 
            padding: '10px', 
            marginBottom: '20px', 
            backgroundColor: '#f0f8ff', 
            border: '1px solid #0066cc',
            borderRadius: '4px'
          }}>
            {message}
          </div>
        )}

        <div style={{ marginBottom: '30px' }}>
          <h2>Quick Actions</h2>
          <button
            onClick={postLunchMessage}
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
            📬 Post Today's Lunch Message
          </button>
          
          <button
            onClick={fetchSummary}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            🔄 Refresh Summary
          </button>
        </div>

        {summary && (
          <div>
            <h2>📊 Today's Summary - {summary.date}</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '15px',
              marginBottom: '20px'
            }}>
              <div style={{ padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2d5f2d' }}>📈 Ordered</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2d5f2d' }}>
                  {summary.summary.totalOrders}
                </div>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>👥 Total Members</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#856404' }}>
                  {summary.summary.totalMembers}
                </div>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: '#f8d7da', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#721c24' }}>⏳ Not Ordered</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#721c24' }}>
                  {summary.summary.nonOrderedUsers.length}
                </div>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: '#d1ecf1', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>📊 Order Rate</h3>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c5460' }}>
                  {summary.summary.orderingRate}%
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h3>✅ People Who Ordered ({summary.summary.orderedUsers.length})</h3>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px',
                  borderRadius: '4px'
                }}>
                  {summary.summary.orderedUsers.length > 0 ? (
                    summary.summary.orderedUsers.map((user, index) => (
                      <div key={index} style={{ padding: '5px 0', borderBottom: '1px solid #eee' }}>
                        <strong>{user.username}</strong>
                        <br />
                        <small style={{ color: '#666' }}>
                          {new Date(user.timestamp).toLocaleTimeString()}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#666', fontStyle: 'italic' }}>No orders yet</p>
                  )}
                </div>
              </div>

              <div>
                <h3>⏳ Haven't Ordered Yet ({summary.summary.nonOrderedUsers.length})</h3>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px',
                  borderRadius: '4px'
                }}>
                  {summary.summary.nonOrderedUsers.length > 0 ? (
                    summary.summary.nonOrderedUsers.map((user, index) => (
                      <div key={index} style={{ padding: '5px 0', borderBottom: '1px solid #eee' }}>
                        {user.username}
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#28a745', fontWeight: 'bold' }}>Everyone has ordered! 🎉</p>
                  )}
                </div>
              </div>
            </div>

            {summary.summary.nonOrderedUsers.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h3>📢 Send Reminders</h3>
                <button
                  onClick={() => sendReminder('gentle')}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    marginRight: '10px',
                    backgroundColor: '#ffc107',
                    color: '#212529',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  😊 Send Gentle Reminder
                </button>
                
                <button
                  onClick={() => sendReminder('urgent')}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  🚨 Send Urgent Reminder
                </button>
              </div>
            )}
          </div>
        )}

        {!summary && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p>No lunch orders found for today. Click "Post Today's Lunch Message" to get started!</p>
          </div>
        )}
      </div>
    </>
  );
};

export default LunchAdminPage; 