import { useState, useEffect } from 'react';
import { ReportData } from '../../types/quiz';

export const QuizReportSidebar = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<'quiz' | 'pronunciation'>('quiz');

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

  const tabStyle = {
    display: 'flex',
    gap: '4px',
    marginBottom: '12px',
    borderRadius: '6px',
    backgroundColor: '#f0f0f0',
    padding: '2px',
  };

  const tabButtonStyle = (isActive: boolean) => ({
    flex: 1,
    padding: '6px 8px',
    fontSize: '11px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: isActive ? 'white' : 'transparent',
    color: isActive ? '#0070f3' : '#666',
    fontWeight: isActive ? 'bold' : 'normal',
  });

  if (loading) {
    return (
      <div style={sidebarStyle}>
        <h3>Performance Report</h3>
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={sidebarStyle}>
        <h3>Performance Report</h3>
        <div>Error: {error}</div>
        <button onClick={() => fetchReportData(selectedWeek)}>Retry</button>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div style={sidebarStyle}>
        <h3>Performance Report</h3>
        <div>No data available</div>
      </div>
    );
  }

  const avgAccuracy = reportData.userScores?.length > 0 
    ? Math.round(reportData.userScores.reduce((sum, user) => sum + user.accuracy, 0) / reportData.userScores.length) 
    : 0;

  const avgPronunciation = reportData.pronunciation?.stats?.overallAverageScore || 0;

  return (
    <div style={sidebarStyle}>
      <h3>Performance Report</h3>
      
      {/* View Toggle */}
      <div style={tabStyle}>
        <button 
          style={tabButtonStyle(activeView === 'quiz')}
          onClick={() => setActiveView('quiz')}
        >
          📝 Quiz
        </button>
        <button 
          style={tabButtonStyle(activeView === 'pronunciation')}
          onClick={() => setActiveView('pronunciation')}
        >
          🎤 Audio
        </button>
      </div>

      {/* Week selector - only show for quiz view */}
      {activeView === 'quiz' && availableWeeks.length > 0 && (
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
      
      {/* Quiz View */}
      {activeView === 'quiz' && (
        <>
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
            <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>🏆 Quiz Leaders</h4>
            {reportData.userScores?.slice(0, 5).map((user, index) => (
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
            )) || <div style={{ fontSize: '11px', color: '#666' }}>No quiz attempts yet</div>}
          </div>
        </>
      )}

      {/* Pronunciation View */}
      {activeView === 'pronunciation' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{reportData.pronunciation?.stats?.totalAttempts || 0}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Attempts</div>
            </div>
            <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{reportData.pronunciation?.stats?.totalUsers || 0}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Users</div>
            </div>
            <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{Math.round(avgPronunciation)}/100</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Avg Score</div>
            </div>
            <div style={{ background: 'white', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{reportData.pronunciation?.stats?.uniqueThreads || 0}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Content</div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>🎤 Pronunciation Leaders</h4>
            {reportData.pronunciation?.userScores?.slice(0, 5).map((user, index) => (
              <div key={user.userId} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '4px 8px', 
                background: index === 0 ? '#fff9e6' : 'white',
                borderRadius: '4px',
                marginBottom: '2px',
                fontSize: '11px'
              }}>
                <div>
                  <div>{index + 1}. {user.username}</div>
                  <div style={{ fontSize: '9px', color: '#666' }}>
                    {user.totalAttempts} attempt{user.totalAttempts !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold' }}>{user.averageScore}/100</div>
                  {user.improvementTrend !== 0 && (
                    <div style={{ 
                      fontSize: '9px', 
                      color: user.improvementTrend > 0 ? '#28a745' : '#dc3545'
                    }}>
                      {user.improvementTrend > 0 ? '↗️' : '↘️'} {Math.abs(user.improvementTrend)}
                    </div>
                  )}
                </div>
              </div>
            )) || <div style={{ fontSize: '11px', color: '#666' }}>No pronunciation attempts yet</div>}
          </div>

          {/* Most Challenging Content */}
          {reportData.pronunciation?.stats?.threadStats && reportData.pronunciation.stats.threadStats.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '4px' }}>📰 Hardest Content</h4>
                             {reportData.pronunciation.stats.threadStats.slice(0, 3).map((stat) => (
                <div key={stat.threadId} style={{ 
                  padding: '6px 8px', 
                  background: 'white',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  fontSize: '10px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    {stat.originalText.length > 40 
                      ? stat.originalText.substring(0, 40) + '...' 
                      : stat.originalText}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                    <span>{stat.attempts} attempts</span>
                    <span style={{ 
                      color: stat.averageScore >= 70 ? '#28a745' : 
                             stat.averageScore >= 50 ? '#ffc107' : '#dc3545',
                      fontWeight: 'bold'
                    }}>
                      {stat.averageScore}/100
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

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