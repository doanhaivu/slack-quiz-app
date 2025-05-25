import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getAllQuizzes } from '../utils/quizzes';

interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

interface VocabularyItem {
  term: string;
  definition: string;
}

interface Quiz {
  date?: string;
  timestamp?: string;
  slackMessageId?: string;
  quiz: QuizQuestion[];
  vocabulary?: VocabularyItem[];
  title?: string;
  summary?: string;
  url?: string | null;
  category?: string;
}

interface Props {
  quizzes: Quiz[];
}

const pageStyles = {
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '2rem',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '1rem',
    textAlign: 'center' as const,
  },
  description: {
    marginBottom: '2rem',
    textAlign: 'center' as const,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    border: '1px solid #eaeaea',
    borderRadius: '10px',
    padding: '1.5rem',
    transition: 'box-shadow 0.2s ease',
  },
};

export default function Quizzes({ quizzes }: Props) {
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    if (expandedQuiz === id) {
      setExpandedQuiz(null);
    } else {
      setExpandedQuiz(id);
    }
  };

  return (
    <div style={pageStyles.container}>
      <main>
        <h1 style={pageStyles.title}>Quiz Library</h1>
        <p style={pageStyles.description}>
          View all quizzes created in the system
        </p>

        <div style={pageStyles.grid}>
          {quizzes.length === 0 ? (
            <p>No quizzes found.</p>
          ) : (
            quizzes.map((quiz) => {
              const id = quiz.slackMessageId || quiz.timestamp || '';
              return (
                <div key={id} style={pageStyles.card}>
                  <h2>{quiz.title || 'Untitled Quiz'}</h2>
                  <p>{quiz.date ? new Date(quiz.date).toLocaleDateString() : 'No date'}</p>
                  <p>{quiz.summary || 'No summary available'}</p>
                  
                  <button onClick={() => toggleExpand(id)}>
                    {expandedQuiz === id ? 'Hide Details' : 'Show Details'}
                  </button>
                  
                  {expandedQuiz === id && (
                    <div>
                      <h3>Questions</h3>
                      {quiz.quiz.map((q, qIndex) => (
                        <div key={qIndex} style={{ marginBottom: '20px' }}>
                          <p><strong>Q{qIndex+1}:</strong> {q.question}</p>
                          <ul>
                            {q.options.map((option, oIndex) => (
                              <li key={oIndex} style={{ 
                                color: option === q.correct ? 'green' : 'inherit',
                                fontWeight: option === q.correct ? 'bold' : 'normal'
                              }}>
                                {option} {option === q.correct ? '✓' : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      
                      {quiz.vocabulary && quiz.vocabulary.length > 0 && (
                        <>
                          <h3>Vocabulary</h3>
                          {quiz.vocabulary.map((v, vIndex) => (
                            <div key={vIndex}>
                              <strong>{v.term}:</strong> {v.definition}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const quizzes = await getAllQuizzes();
  
  return {
    props: {
      quizzes: JSON.parse(JSON.stringify(quizzes)) // Serialize dates properly
    }
  };
} 