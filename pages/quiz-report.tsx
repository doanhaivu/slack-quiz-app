import { useState, useEffect } from 'react';

interface UserScore {
  userId: string;
  username: string;
  score: number;
  totalAnswered: number;
  correctAnswers: number;
  accuracy: number;
}

interface QuestionStat {
  attempts: number;
  correct: number;
  question: string;
  quizId: string;
  questionIndex: number;
  correctPercentage: number;
}

interface QuizStats {
  totalResponses: number;
  uniqueUsers: number;
  questionStats: QuestionStat[];
}

interface ReportData {
  userScores: UserScore[];
  quizStats: QuizStats;
}

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
    display: 'flex',
    justifyContent: 'space-around',
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
};

export default function QuizReport() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/quiz-report');
      
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

  useEffect(() => {
    fetchReportData();
  }, []);

  const getRowStyle = (index: number) => {
    if (index === 0) return pageStyles.leaderboardRowFirst;
    if (index === 1) return pageStyles.leaderboardRowSecond;
    if (index === 2) return pageStyles.leaderboardRowThird;
    return pageStyles.leaderboardRow;
  };

  return (
    <div style={pageStyles.container}>
      <h1 style={pageStyles.title}>Quiz Performance Report</h1>

      {loading && (
        <div style={pageStyles.loading}>
          Loading report data...
        </div>
      )}

      {error && (
        <div style={pageStyles.error}>
          Error: {error}
          <div>
            <button style={pageStyles.refreshButton} onClick={fetchReportData}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {reportData && (
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
          </div>

          <div style={pageStyles.section}>
            <h2 style={pageStyles.subtitle}>Leaderboard</h2>
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
            <h2 style={pageStyles.subtitle}>Question Difficulty</h2>
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

          <div style={{textAlign: 'center'}}>
            <button style={pageStyles.refreshButton} onClick={fetchReportData}>
              Refresh Data
            </button>
          </div>
        </>
      )}
    </div>
  );
} 