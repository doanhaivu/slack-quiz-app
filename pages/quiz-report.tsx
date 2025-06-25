import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import { ReportData } from '../types/quiz';
import ProtectedRoute from '../components/ProtectedRoute';

const pageStyles = {
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  section: {
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '1rem',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '1.5rem',
    marginBottom: '1rem',
    borderBottom: '1px solid #eaeaea',
    paddingBottom: '0.5rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: '1rem',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.5rem',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #ddd',
  },
  td: {
    padding: '0.5rem',
    borderBottom: '1px solid #ddd',
  },
  statsBox: {
    backgroundColor: '#f9f9f9',
    padding: '1rem',
    borderRadius: '5px',
    marginBottom: '1rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '1rem',
  },
  statItem: {
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: '0.9rem',
    color: '#666',
  },
  badge: {
    display: 'inline-block',
    padding: '0.25rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  trendBadge: {
    display: 'inline-block',
    padding: '0.15rem 0.4rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    marginLeft: '0.5rem',
  },
  refreshButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '1rem',
    marginTop: '1rem',
  },
  leaderboardRow: {
    backgroundColor: '#fff',
  },
  leaderboardRowFirst: {
    backgroundColor: '#fff9e6',
  },
  leaderboardRowSecond: {
    backgroundColor: '#f9f9f9',
  },
  leaderboardRowThird: {
    backgroundColor: '#f5f5f5',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '2rem',
    fontSize: '1.2rem',
    color: '#666',
  },
  error: {
    textAlign: 'center' as const,
    padding: '2rem',
    fontSize: '1.2rem',
    color: '#e00',
  },
  tabContainer: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
    borderBottom: '1px solid #eaeaea',
  },
  tab: {
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    fontSize: '1rem',
  },
  activeTab: {
    borderBottom: '2px solid #0070f3',
    color: '#0070f3',
    fontWeight: 'bold',
  },
  weekSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
    padding: '1rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '5px',
  },
  weekLabel: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#333',
  },
  weekDropdown: {
    padding: '0.5rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '5px',
    backgroundColor: 'white',
    minWidth: '150px',
  },
  weekInfo: {
    fontSize: '0.9rem',
    color: '#666',
    marginLeft: 'auto',
  },
};

const QuizReportPage: NextPage = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quiz' | 'pronunciation'>('quiz');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');

  const fetchReportData = async (week?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const weekParam = week || selectedWeek;
      const url = weekParam && weekParam !== 'all' 
        ? `/api/quiz-report?week=${encodeURIComponent(weekParam)}`
        : '/api/quiz-report';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch report data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setReportData(data);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleWeekChange = async (week: string) => {
    setSelectedWeek(week);
    await fetchReportData(week);
  };

  const handleRefresh = () => {
    fetchReportData();
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const getRowStyle = (index: number) => {
    if (index === 0) return pageStyles.leaderboardRowFirst;
    if (index === 1) return pageStyles.leaderboardRowSecond;
    if (index === 2) return pageStyles.leaderboardRowThird;
    return pageStyles.leaderboardRow;
  };

  const getTrendStyle = (trend: number) => {
    if (trend > 0) return { backgroundColor: '#d4edda', color: '#155724' };
    if (trend < 0) return { backgroundColor: '#f8d7da', color: '#721c24' };
    return { backgroundColor: '#e2e3e5', color: '#495057' };
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return '↗️';
    if (trend < 0) return '↘️';
    return '→';
  };

  return (
    <ProtectedRoute>
      <Head>
        <title>Quiz Report - Slack Quiz App</title>
      </Head>
      <div style={pageStyles.container}>
      <h1 style={pageStyles.title}>Performance Report</h1>

      {loading && (
        <div style={pageStyles.loading}>
          Loading report data...
        </div>
      )}

      {error && (
        <div style={pageStyles.error}>
          Error: {error}
          <div>
            <button style={pageStyles.refreshButton} onClick={handleRefresh}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {reportData && (
        <>
          {/* Week Selection */}
          <div style={pageStyles.weekSelector}>
            <label style={pageStyles.weekLabel}>Time Period:</label>
            <select 
              style={pageStyles.weekDropdown}
              value={selectedWeek}
              onChange={(e) => handleWeekChange(e.target.value)}
            >
              <option value="all">All Time</option>
              {/* Combine quiz and pronunciation weeks, remove duplicates, sort */}
              {[...new Set([
                ...(reportData.availableWeeks || []),
                ...(reportData.pronunciation?.availableWeeks || [])
              ])].sort((a, b) => b.localeCompare(a)).map(week => (
                <option key={week} value={week}>
                  Week of {new Date(week).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </option>
              ))}
            </select>
            <div style={pageStyles.weekInfo}>
              {selectedWeek === 'all' ? 'Showing all-time data' : `Showing data for week of ${new Date(selectedWeek).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={pageStyles.tabContainer}>
            <div 
              style={{
                ...pageStyles.tab,
                ...(activeTab === 'quiz' ? pageStyles.activeTab : {})
              }}
              onClick={() => setActiveTab('quiz')}
            >
              📝 Quiz Performance
            </div>
            <div 
              style={{
                ...pageStyles.tab,
                ...(activeTab === 'pronunciation' ? pageStyles.activeTab : {})
              }}
              onClick={() => setActiveTab('pronunciation')}
            >
              🎤 Pronunciation Practice
            </div>
          </div>

          {/* Quiz Tab */}
          {activeTab === 'quiz' && (
            <>
              <div style={pageStyles.statsBox}>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>{reportData.quizStats.totalResponses}</div>
                  <div style={pageStyles.statLabel}>Total Responses</div>
                </div>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>{reportData.quizStats.uniqueUsers}</div>
                  <div style={pageStyles.statLabel}>Unique Users</div>
                </div>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>
                    {reportData.userScores.length > 0 
                      ? Math.round(reportData.userScores.reduce((sum, user) => sum + user.accuracy, 0) / reportData.userScores.length) 
                      : 0}%
                  </div>
                  <div style={pageStyles.statLabel}>Average Accuracy</div>
                </div>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>{reportData.quizStats.questionStats.length}</div>
                  <div style={pageStyles.statLabel}>Total Questions</div>
                </div>
              </div>

              <div style={pageStyles.section}>
                <h2 style={pageStyles.subtitle}>📊 Quiz Leaderboard</h2>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Rank</th>
                      <th style={pageStyles.th}>User</th>
                      <th style={pageStyles.th}>Score</th>
                      <th style={pageStyles.th}>Questions Answered</th>
                      <th style={pageStyles.th}>Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.userScores.map((user, index) => (
                      <tr key={user.userId} style={getRowStyle(index)}>
                        <td style={pageStyles.td}>{index + 1}</td>
                        <td style={pageStyles.td}>{user.username}</td>
                        <td style={pageStyles.td}>{user.score}</td>
                        <td style={pageStyles.td}>{user.totalAnswered}</td>
                        <td style={pageStyles.td}>{Math.round(user.accuracy)}%</td>
                      </tr>
                    ))}
                    {reportData.userScores.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{...pageStyles.td, textAlign: 'center'}}>
                          No user scores available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={pageStyles.section}>
                <h2 style={pageStyles.subtitle}>❓ Question Difficulty</h2>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Question</th>
                      <th style={pageStyles.th}>Attempts</th>
                      <th style={pageStyles.th}>Correct</th>
                      <th style={pageStyles.th}>Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.quizStats.questionStats.map((stat) => (
                      <tr key={`${stat.quizId}_${stat.questionIndex}`}>
                        <td style={pageStyles.td}>{stat.question}</td>
                        <td style={pageStyles.td}>{stat.attempts}</td>
                        <td style={pageStyles.td}>{stat.correct}</td>
                        <td style={pageStyles.td}>
                          <div style={{
                            ...pageStyles.badge,
                            backgroundColor: 
                              stat.correctPercentage >= 75 ? '#d4edda' :
                              stat.correctPercentage >= 50 ? '#fff3cd' : 
                              '#f8d7da',
                            color:
                              stat.correctPercentage >= 75 ? '#155724' :
                              stat.correctPercentage >= 50 ? '#856404' : 
                              '#721c24'
                          }}>
                            {Math.round(stat.correctPercentage)}%
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reportData.quizStats.questionStats.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{...pageStyles.td, textAlign: 'center'}}>
                          No question statistics available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pronunciation Tab */}
          {activeTab === 'pronunciation' && (
            <>
              <div style={pageStyles.statsBox}>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>{reportData.pronunciation.stats.totalAttempts}</div>
                  <div style={pageStyles.statLabel}>Total Attempts</div>
                </div>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>{reportData.pronunciation.stats.totalUsers}</div>
                  <div style={pageStyles.statLabel}>Active Users</div>
                </div>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>{reportData.pronunciation.stats.overallAverageScore}/100</div>
                  <div style={pageStyles.statLabel}>Average Score</div>
                </div>
                <div style={pageStyles.statItem}>
                  <div style={pageStyles.statValue}>{reportData.pronunciation.stats.uniqueThreads}</div>
                  <div style={pageStyles.statLabel}>Content Pieces</div>
                </div>
              </div>

              <div style={pageStyles.section}>
                <h2 style={pageStyles.subtitle}>🎤 Pronunciation Leaderboard</h2>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Rank</th>
                      <th style={pageStyles.th}>User</th>
                      <th style={pageStyles.th}>Average Score</th>
                      <th style={pageStyles.th}>Best Score</th>
                      <th style={pageStyles.th}>Attempts</th>
                      <th style={pageStyles.th}>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.pronunciation.userScores.map((user, index) => (
                      <tr key={user.userId} style={getRowStyle(index)}>
                        <td style={pageStyles.td}>{index + 1}</td>
                        <td style={pageStyles.td}>{user.username}</td>
                        <td style={pageStyles.td}>{user.averageScore}/100</td>
                        <td style={pageStyles.td}>{user.bestScore}/100</td>
                        <td style={pageStyles.td}>{user.totalAttempts}</td>
                        <td style={pageStyles.td}>
                          {user.improvementTrend !== 0 && (
                            <div style={{
                              ...pageStyles.trendBadge,
                              ...getTrendStyle(user.improvementTrend)
                            }}>
                              {getTrendIcon(user.improvementTrend)} {Math.abs(user.improvementTrend)}
                            </div>
                          )}
                          {user.improvementTrend === 0 && (
                            <span style={{ color: '#666', fontSize: '0.85rem' }}>First attempt</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reportData.pronunciation.userScores.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{...pageStyles.td, textAlign: 'center'}}>
                          No pronunciation attempts yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={pageStyles.section}>
                <h2 style={pageStyles.subtitle}>📰 Content Difficulty</h2>
                <table style={pageStyles.table}>
                  <thead>
                    <tr>
                      <th style={pageStyles.th}>Content</th>
                      <th style={pageStyles.th}>Attempts</th>
                      <th style={pageStyles.th}>Average Score</th>
                      <th style={pageStyles.th}>Best Score</th>
                      <th style={pageStyles.th}>Difficulty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.pronunciation.stats.threadStats.map((stat) => (
                      <tr key={stat.threadId}>
                        <td style={pageStyles.td}>{stat.originalText}</td>
                        <td style={pageStyles.td}>{stat.attempts}</td>
                        <td style={pageStyles.td}>{stat.averageScore}/100</td>
                        <td style={pageStyles.td}>{stat.bestScore}/100</td>
                        <td style={pageStyles.td}>
                          <div style={{
                            ...pageStyles.badge,
                            backgroundColor: 
                              stat.averageScore >= 70 ? '#d4edda' :
                              stat.averageScore >= 50 ? '#fff3cd' : 
                              '#f8d7da',
                            color:
                              stat.averageScore >= 70 ? '#155724' :
                              stat.averageScore >= 50 ? '#856404' : 
                              '#721c24'
                          }}>
                            {stat.averageScore >= 70 ? 'Easy' : 
                             stat.averageScore >= 50 ? 'Medium' : 'Hard'}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reportData.pronunciation.stats.threadStats.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{...pageStyles.td, textAlign: 'center'}}>
                          No content statistics available yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div style={{textAlign: 'center'}}>
            <button style={pageStyles.refreshButton} onClick={handleRefresh}>
              Refresh Data
            </button>
          </div>
        </>
      )}
    </div>
    </ProtectedRoute>
  );
};

export default QuizReportPage; 