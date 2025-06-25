import { useState, useEffect } from 'react';
import { UserScore, ReportData } from '../../types/quiz';

export const QuizReportSidebar = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);

  const fetchReportData = async (week?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const url = week && week !== 'all' 
        ? `/api/quiz-report?week=${encodeURIComponent(week)}`
        : '/api/quiz-report';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const data = await response.json();
      setReportData(data);
      setAvailableWeeks(data.availableWeeks || []);
      setSelectedWeek(data.currentWeek || 'all');
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week);
    fetchReportData(week);
  };

  const formatWeekDisplay = (weekString: string) => {
    if (weekString === 'all') return 'All Time';
    
    const date = new Date(weekString);
    const endDate = new Date(date);
    endDate.setDate(date.getDate() + 6);
    
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    return `${formatDate(date)} - ${formatDate(endDate)}`;
  };

  const sidebarStyle = {
    height: '100%',
    padding: '16px',
    fontSize: '14px',
    color: '#333',
  };

  if (loading) {
    return (
      <div style={sidebarStyle}>
        <h3>Quiz Performance</h3>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={sidebarStyle}>
        <h3>Quiz Performance</h3>
        <div>Error: {error}</div>
        <button onClick={() => fetchReportData(selectedWeek)}>Retry</button>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div style={sidebarStyle}>
        <h3>Quiz Performance</h3>
        <div>No data available</div>
      </div>
    );
  }

  const avgAccuracy = reportData.userScores?.length > 0 
    ? Math.round(reportData.userScores.reduce((sum: number, user: UserScore) => sum + user.accuracy, 0) / reportData.userScores.length) 
    : 0;

  return (
    <div style={sidebarStyle}>
      <h3>Quiz Performance</h3>
      
      {/* Week selector */}
      {availableWeeks.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>
            Time Period:
          </label>
          <select 
            value={selectedWeek} 
            onChange={(e) => handleWeekChange(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
          >
            <option value="all">All Time</option>
            {availableWeeks.map(week => (
              <option key={week} value={week}>
                {formatWeekDisplay(week)}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{reportData.quizStats?.totalResponses || 0}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>Responses</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{reportData.quizStats?.uniqueUsers || 0}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>Users</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{avgAccuracy}%</div>
          <div style={{ fontSize: '10px', color: '#666' }}>Avg Accuracy</div>
        </div>
        <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{reportData.quizStats?.questionStats?.length || 0}</div>
          <div style={{ fontSize: '10px', color: '#666' }}>Questions</div>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>🏆 Top Users</h4>
        {reportData.userScores?.slice(0, 5).map((user: UserScore, index: number) => (
          <div key={user.userId} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '4px 8px', 
            background: index === 0 ? '#fff9e6' : 'white',
            borderRadius: '4px',
            marginBottom: '2px',
            fontSize: '11px'
          }}>
            <span>{index + 1}. {user.username}</span>
            <span>{user.score} pts</span>
          </div>
        )) || <div>No users yet</div>}
      </div>

      <button 
        onClick={() => fetchReportData(selectedWeek)}
        style={{
          width: '100%',
          padding: '8px',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        Refresh
      </button>
    </div>
  );
}; 