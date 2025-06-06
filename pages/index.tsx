// pages/index.tsx
import { useState, ChangeEvent, useEffect, ClipboardEvent } from 'react';
import styles from '../styles/Home.module.css';
import ChannelSelector from '../components/ChannelSelector';
import LogDisplay from '../components/LogDisplay';
import { useLogs } from '../contexts/LogContext';

// Simple inline QuizReportSidebar component
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
  availableWeeks: string[];
  currentWeek: string;
}

const QuizReportSidebar = () => {
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

// Define styles type to include all CSS classes
interface Styles {
  container: string;
  title: string;
  form: string;
  label: string;
  input: string;
  textarea: string;
  select: string;
  button: string;
  result: string;
  tabs: string;
  tabButton: string;
  activeTab: string;
  extractContainer: string;
  extractTextarea: string;
  extractedContent: string;
  categoryHeading: string;
  itemCard: string;
  itemActions: string;
  editableTitle: string;
  editableContent: string;
  buttonGroup: string;
  postButton: string;
  removeButton: string;
  detailsContainer: string;
  detailsSummary: string;
  detailsContent: string;
  collectiveSection: string;
  regeneratingIndicator: string;
  loadingSpinner: string;
  itemQuizSection: string;
  itemSectionTitle: string;
  quizItem: string;
  questionText: string;
  optionsContainer: string;
  optionItem: string;
  correctOption: string;
  correctIndicator: string;
  itemVocabSection: string;
  vocabItem: string;
  vocabTerm: string;
  vocabDefinition: string;
  regenerateButton: string;
  pastedMediaPreview: string;
  pastedImagesContainer: string;
  imageGrid: string;
  pastedImage: string;
  pastedUrlsContainer: string;
  urlList: string;
  urlItem: string;
  twoColumnLayout: string;
  logsColumn: string;
  mainColumn: string;
  leftSidebar: string;
  logsSection: string;
  mainContent: string;
  threeColumnLayout: string;
  rightSidebar: string;
  audioSection: string;
  audioItem: string;
  audioTitle: string;
  audioPlayer: string;
}

// Type assertion for styles import
const typedStyles = styles as Styles;

interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

interface VocabularyItem {
  term: string;
  definition: string;
}

interface ExtractedItem {
  category: 'news' | 'tools' | 'prompts';
  title: string;
  content: string;
  url?: string;
  quiz?: QuizQuestion[];
  vocabulary?: VocabularyItem[];
  slackMessageId?: string;
  audioUrl?: string;
}

interface ExtractedContent {
  news: ExtractedItem[];
  tools: ExtractedItem[];
  prompts: ExtractedItem[];
}

interface ExtractResult {
  message: string;
  extractedContent: ExtractedContent;
}

interface PostResult {
  message: string;
  results: Array<{
    category: string;
    title?: string;
    count?: number;
    slackMessageId: string;
  }>;
}

export default function Home() {
  const [pastedText, setPastedText] = useState<string>('');
  const [pastedImages, setPastedImages] = useState<string[]>([]);
  const [pastedUrls, setPastedUrls] = useState<string[]>([]);
  const [loadingExtract, setLoadingExtract] = useState<boolean>(false);
  const [loadingPost, setLoadingPost] = useState<boolean>(false);
  const [loadingRegenerate, setLoadingRegenerate] = useState<boolean>(false);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [postResult, setPostResult] = useState<PostResult | null>(null);
  const [editedContent, setEditedContent] = useState<ExtractedContent | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('C08ST272AAG'); // Default channel
  const [isTextareaCollapsed, setIsTextareaCollapsed] = useState<boolean>(false);
  const [showTextarea, setShowTextarea] = useState<boolean>(true);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [extractionStatus, setExtractionStatus] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  
  const { logs, addLog, clearLogs } = useLogs();
  
  // Update edited content whenever extract result changes
  useEffect(() => {
    if (extractResult && extractResult.extractedContent) {
      setEditedContent(JSON.parse(JSON.stringify(extractResult.extractedContent)));
    }
  }, [extractResult]);

  // Scroll detection to show/hide textarea
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const shouldShow = scrollY < 100; // Show when scrolled near top
      
      setShowTextarea(shouldShow);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Enhanced logging to capture console logs
  useEffect(() => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;

    console.log = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLog(`${message}`);
      originalConsoleLog(...args);
    };

    console.error = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLog(`ERROR: ${message}`);
      originalConsoleError(...args);
    };

    console.warn = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLog(`WARN: ${message}`);
      originalConsoleWarn(...args);
    };

    console.info = (...args) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLog(`INFO: ${message}`);
      originalConsoleInfo(...args);
    };

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    };
  }, [addLog]);

  const handlePastedTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setPastedText(e.target.value);
  };

  // Handle paste event to capture rich content
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    // Clear previous images and URLs to prevent accumulation
    setPastedImages([]);
    setPastedUrls([]);
    
    // Get plain text content
    const text = e.clipboardData.getData('text/plain');
    setPastedText(text);
    
    // Try to extract HTML content
    const html = e.clipboardData.getData('text/html');
    
    // Create temporary element to parse HTML content
    if (html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Extract all links
      const links: string[] = [];
      const linkElements = tempDiv.querySelectorAll('a');
      linkElements.forEach(link => {
        if (link.href) links.push(link.href);
      });
      setPastedUrls(links);
      
      // Extract all images
      const images: string[] = [];
      const imageElements = tempDiv.querySelectorAll('img');
      imageElements.forEach(img => {
        if (img.src) {
          // Skip emoji images
          if (!img.src.includes('emoji') && img.src.length > 30) {
            images.push(img.src);
            console.log(`Found image from HTML: ${img.src.substring(0, 30)}...`);
          } else {
            console.log(`Skipping emoji image: ${img.src.substring(0, 30)}...`);
          }
        }
      });
      setPastedImages(images);
      
      console.log('Extracted from paste:', { links, images });
    }
    
    // Check for files (images) in the clipboard
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles = Array.from(e.clipboardData.files).filter(file => 
        file.type.startsWith('image/')
      );
      
      if (imageFiles.length > 0) {
        console.log(`Found ${imageFiles.length} image files in clipboard`);
        
        // Convert image files to data URLs
        imageFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target && event.target.result) {
              const dataUrl = event.target!.result as string;
              console.log(`Converted image to data URL: ${dataUrl.substring(0, 30)}...`);
              setPastedImages(prev => [...prev, dataUrl]);
            }
          };
          reader.readAsDataURL(file);
        });
      }
    }
  };

  const handleExtract = async () => {
    if (!pastedText.trim() && pastedImages.length === 0 && pastedUrls.length === 0) {
      alert('Please paste some content first');
      return;
    }
    
    setLoadingExtract(true);
    setIsExtracting(true);
    setExtractResult(null);
    setPostResult(null);
    setIsTextareaCollapsed(true); // Collapse textarea when extracting
    setExtractionProgress(0);
    clearLogs();
    
    try {
      // Stage 1: Preparation
      setExtractionStatus('🔄 Preparing content for extraction...');
      setExtractionProgress(10);
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UX
      
      addLog('Starting content extraction...');
      addLog(`Processing paste with ${pastedUrls.length} URLs and ${pastedImages.length} images`);
      
      // Stage 2: Validation
      setExtractionStatus('✅ Validating content and media...');
      setExtractionProgress(20);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Improve logging for debugging image issues
      addLog(`Sending ${pastedImages.length} images and ${pastedUrls.length} URLs to API`);
      if (pastedImages.length > 0) {
        addLog(`First image preview: ${pastedImages[0].substring(0, 30)}...`);
      }
      
      // Stage 3: Sending to API
      setExtractionStatus('🚀 Sending content to processing engine...');
      setExtractionProgress(30);
      
      // Include images and URLs in the extraction request
      const res = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'extract',
          text: pastedText,
          images: pastedImages,
          urls: pastedUrls,
          channelId: selectedChannel // Add channel ID to the request
        }),
      });
      
      // Stage 4: Processing Response
      setExtractionStatus('🤖 AI is analyzing and extracting content...');
      setExtractionProgress(60);
      
      const data = await res.json();
      
      // Stage 5: Processing Results
      setExtractionStatus('📝 Processing extracted items...');
      setExtractionProgress(80);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Add server logs to client logs
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((log: string) => addLog(log));
      }
      
      // Stage 6: Finalizing
      setExtractionStatus('🎯 Finalizing results...');
      setExtractionProgress(95);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      addLog('Extraction completed successfully');
      if (data.extractedContent) {
        addLog(`Found ${data.extractedContent.news?.length || 0} news items, ${data.extractedContent.tools?.length || 0} tools, and ${data.extractedContent.prompts?.length || 0} prompts`);
      }
      
      // Stage 7: Complete
      setExtractionStatus('✨ Extraction completed successfully!');
      setExtractionProgress(100);
      
      setExtractResult(data);
      
      // Auto-hide progress bar after completion
      setTimeout(() => {
        setIsExtracting(false);
        setExtractionProgress(0);
      }, 2000);
      
    } catch (error) {
      console.error('Error extracting content:', error);
      addLog(`Error extracting content: ${error}`);
      setExtractionStatus('❌ Extraction failed - please try again');
      setExtractionProgress(0);
      alert('Error extracting content');
      
      // Hide progress bar on error
      setTimeout(() => {
        setIsExtracting(false);
      }, 3000);
    }
    setLoadingExtract(false);
  };
  
  const handlePost = async () => {
    if (!editedContent) {
      alert('No content to post');
      return;
    }
    
    setLoadingPost(true);
    addLog('Posting all content to Slack...');
    
    try {
      const res = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post',
          extractedContent: editedContent,
          channelId: selectedChannel
        }),
      });
      const data = await res.json();
      
      // Add server logs to client logs
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((log: string) => addLog(log));
      }
      
      addLog('Content successfully posted to Slack');
      setPostResult(data);
    } catch (error) {
      console.error(error);
      addLog(`Error posting content: ${error}`);
      alert('Error posting content to Slack');
    }
    setLoadingPost(false);
  };
  
  const handlePostExtractedOnly = async () => {
    if (!editedContent || loadingPost) return;
    
    setLoadingPost(true);
    addLog('Posting extracted items only to Slack...');
    
    try {
      // Pass the original pasted images to ensure they're available during posting
      const res = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_extracted_only',
          extractedContent: editedContent,
          images: pastedImages,  // Pass the pasted images directly
          urls: pastedUrls,      // Pass the detected URLs
          channelId: selectedChannel
        }),
      });
      const data = await res.json();
      
      // Add server logs to client logs
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((log: string) => addLog(log));
      }
      
      addLog('Items successfully posted to Slack');
      
      // Update the edited content with the message IDs from the response
      if (data.extractedContent) {
        setEditedContent(data.extractedContent);
      }
      
      setPostResult(data);
    } catch (error) {
      console.error(error);
      addLog(`Error posting extracted items: ${error}`);
      alert('Error posting extracted items to Slack');
    }
    setLoadingPost(false);
  };
  
  const handlePostQuizVocabAsReplies = async () => {
    if (!editedContent || loadingPost) return;
    
    setLoadingPost(true);
    addLog('Posting vocabulary and quizzes as replies to Slack...');
    
    try {
      const res = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_quiz_vocab_as_replies',
          extractedContent: editedContent,
          channelId: selectedChannel
        }),
      });
      const data = await res.json();
      
      // Add server logs to client logs
      if (data.logs && Array.isArray(data.logs)) {
        data.logs.forEach((log: string) => addLog(log));
      }
      
      addLog('Vocabulary and quizzes successfully posted as replies');
      setPostResult(data);
    } catch (error) {
      console.error(error);
      addLog(`Error posting vocabulary and quizzes: ${error}`);
      alert('Error posting vocabulary and quizzes to Slack');
    }
    setLoadingPost(false);
  };
  
  const handleRemoveItem = async (category: keyof ExtractedContent, index: number) => {
    if (!editedContent || loadingRegenerate) return;
    
    setLoadingRegenerate(true);
    
    // Update the UI to show we're removing the item
    const newContent = { ...editedContent };
    newContent[category] = newContent[category].filter((_, i) => i !== index);
    setEditedContent(newContent);
    
    // No need to regenerate collective quiz and vocabulary anymore
    // Just set loading state to false after a brief delay
    setTimeout(() => {
      setLoadingRegenerate(false);
    }, 500);
  };
  
  // Handlers for editing extracted content
  const handleTitleChange = (category: keyof ExtractedContent, index: number, value: string) => {
    if (!editedContent) return;
    
    const newContent = { ...editedContent };
    newContent[category][index].title = value;
    setEditedContent(newContent);
  };
  
  const handleContentChange = (category: keyof ExtractedContent, index: number, value: string) => {
    if (!editedContent) return;
    
    const newContent = { ...editedContent };
    newContent[category][index].content = value;
    setEditedContent(newContent);
  };
  
  const handleUrlChange = (category: keyof ExtractedContent, index: number, value: string) => {
    if (!editedContent) return;
    
    const newContent = { ...editedContent };
    newContent[category][index].url = value;
    setEditedContent(newContent);
  };
  
  const renderExtractedContentForReview = () => {
    if (!editedContent) return null;
    
    return (
      <div className={typedStyles.extractedContent}>
        {/* News Items */}
        {editedContent.news && editedContent.news.length > 0 && (
          <>
            <h3 className={typedStyles.categoryHeading}>News Items</h3>
            {editedContent.news.map((item, index) => (
              <div key={`news-${index}`} className={typedStyles.itemCard}>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleTitleChange('news', index, e.target.value)}
                  className={typedStyles.editableTitle}
                  placeholder="Title"
                />
                <textarea
                  value={item.content}
                  onChange={(e) => handleContentChange('news', index, e.target.value)}
                  className={typedStyles.editableContent}
                  placeholder="Content"
                  rows={3}
                />
                <input
                  type="url"
                  value={item.url || ''}
                  onChange={(e) => handleUrlChange('news', index, e.target.value)}
                  className={typedStyles.input}
                  placeholder="URL (optional)"
                />
                
                {/* Display Quiz for this item */}
                {item.quiz && item.quiz.length > 0 && (
                  <div className={typedStyles.itemQuizSection}>
                    <h4 className={typedStyles.itemSectionTitle}>📝 Quiz Questions</h4>
                    {item.quiz.map((question, qIndex) => (
                      <div key={`quiz-${index}-${qIndex}`} className={typedStyles.quizItem}>
                        <p className={typedStyles.questionText}><strong>Q{qIndex + 1}:</strong> {question.question}</p>
                        <div className={typedStyles.optionsContainer}>
                          {question.options.map((option, oIndex) => (
                            <div key={`option-${index}-${qIndex}-${oIndex}`} className={typedStyles.optionItem}>
                              <span className={option === question.correct ? typedStyles.correctOption : ''}>{option}</span>
                              {option === question.correct && <span className={typedStyles.correctIndicator}>✓</span>}
                            </div>
                          ))}
                        </div>
                        <button 
                          className={typedStyles.removeButton}
                          onClick={() => handleRemoveQuizQuestion('news', index, qIndex)}
                          disabled={loadingRegenerate}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Display Vocabulary for this item */}
                {item.vocabulary && item.vocabulary.length > 0 && (
                  <div className={typedStyles.itemVocabSection}>
                    <h4 className={typedStyles.itemSectionTitle}>📚 Vocabulary</h4>
                    {item.vocabulary.map((vocabItem, vIndex) => (
                      <div key={`vocab-${index}-${vIndex}`} className={typedStyles.vocabItem}>
                        <span className={typedStyles.vocabTerm}>{vocabItem.term}:</span>
                        <span className={typedStyles.vocabDefinition}>{vocabItem.definition}</span>
                        <button 
                          className={typedStyles.removeButton}
                          onClick={() => handleRemoveVocabItem('news', index, vIndex)}
                          disabled={loadingRegenerate}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={typedStyles.itemActions}>
                  <button 
                    className={typedStyles.regenerateButton}
                    onClick={() => handleRegenerateItemContent('news', index)}
                    disabled={loadingRegenerate}
                  >
                    Regenerate Quiz & Vocab
                  </button>
                  <button 
                    className={typedStyles.postButton}
                    onClick={() => handlePostSingleItem('news', index)}
                    disabled={loadingPost}
                  >
                    Post to Slack
                  </button>
                  <button 
                    className={typedStyles.removeButton}
                    onClick={() => handleRemoveItem('news', index)}
                    disabled={loadingRegenerate}
                  >
                    {loadingRegenerate ? 'Removing...' : 'Remove Item'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* Tools Items */}
        {editedContent.tools && editedContent.tools.length > 0 && (
          <>
            <h3 className={typedStyles.categoryHeading}>Tools</h3>
            {editedContent.tools.map((item, index) => (
              <div key={`tools-${index}`} className={typedStyles.itemCard}>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleTitleChange('tools', index, e.target.value)}
                  className={typedStyles.editableTitle}
                  placeholder="Title"
                />
                <textarea
                  value={item.content}
                  onChange={(e) => handleContentChange('tools', index, e.target.value)}
                  className={typedStyles.editableContent}
                  placeholder="Content"
                  rows={3}
                />
                <input
                  type="url"
                  value={item.url || ''}
                  onChange={(e) => handleUrlChange('tools', index, e.target.value)}
                  className={typedStyles.input}
                  placeholder="URL (optional)"
                />
                
                {/* Display Vocabulary for this tool item */}
                {item.vocabulary && item.vocabulary.length > 0 && (
                  <div className={typedStyles.itemVocabSection}>
                    <h4 className={typedStyles.itemSectionTitle}>📚 Vocabulary</h4>
                    {item.vocabulary.map((vocabItem, vIndex) => (
                      <div key={`vocab-${index}-${vIndex}`} className={typedStyles.vocabItem}>
                        <span className={typedStyles.vocabTerm}>{vocabItem.term}:</span>
                        <span className={typedStyles.vocabDefinition}>{vocabItem.definition}</span>
                        <button 
                          className={typedStyles.removeButton}
                          onClick={() => handleRemoveVocabItem('tools', index, vIndex)}
                          disabled={loadingRegenerate}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={typedStyles.itemActions}>
                  <button 
                    className={typedStyles.regenerateButton}
                    onClick={() => handleRegenerateItemContent('tools', index)}
                    disabled={loadingRegenerate}
                  >
                    Regenerate Vocabulary
                  </button>
                  <button 
                    className={typedStyles.postButton}
                    onClick={() => handlePostSingleItem('tools', index)}
                    disabled={loadingPost}
                  >
                    Post to Slack
                  </button>
                  <button 
                    className={typedStyles.removeButton}
                    onClick={() => handleRemoveItem('tools', index)}
                    disabled={loadingRegenerate}
                  >
                    {loadingRegenerate ? 'Removing...' : 'Remove Item'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* Prompts Items */}
        {editedContent.prompts && editedContent.prompts.length > 0 && (
          <>
            <h3 className={typedStyles.categoryHeading}>Prompts</h3>
            {editedContent.prompts.map((item, index) => (
              <div key={`prompts-${index}`} className={typedStyles.itemCard}>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleTitleChange('prompts', index, e.target.value)}
                  className={typedStyles.editableTitle}
                  placeholder="Title"
                />
                <textarea
                  value={item.content}
                  onChange={(e) => handleContentChange('prompts', index, e.target.value)}
                  className={typedStyles.editableContent}
                  placeholder="Content"
                  rows={3}
                />
                <input
                  type="url"
                  value={item.url || ''}
                  onChange={(e) => handleUrlChange('prompts', index, e.target.value)}
                  className={typedStyles.input}
                  placeholder="URL (optional)"
                />
                
                {/* Display Vocabulary for this prompt item */}
                {item.vocabulary && item.vocabulary.length > 0 && (
                  <div className={typedStyles.itemVocabSection}>
                    <h4 className={typedStyles.itemSectionTitle}>📚 Vocabulary</h4>
                    {item.vocabulary.map((vocabItem, vIndex) => (
                      <div key={`vocab-${index}-${vIndex}`} className={typedStyles.vocabItem}>
                        <span className={typedStyles.vocabTerm}>{vocabItem.term}:</span>
                        <span className={typedStyles.vocabDefinition}>{vocabItem.definition}</span>
                        <button 
                          className={typedStyles.removeButton}
                          onClick={() => handleRemoveVocabItem('prompts', index, vIndex)}
                          disabled={loadingRegenerate}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={typedStyles.itemActions}>
                  <button 
                    className={typedStyles.regenerateButton}
                    onClick={() => handleRegenerateItemContent('prompts', index)}
                    disabled={loadingRegenerate}
                  >
                    Regenerate Vocabulary
                  </button>
                  <button 
                    className={typedStyles.postButton}
                    onClick={() => handlePostSingleItem('prompts', index)}
                    disabled={loadingPost}
                  >
                    Post to Slack
                  </button>
                  <button 
                    className={typedStyles.removeButton}
                    onClick={() => handleRemoveItem('prompts', index)}
                    disabled={loadingRegenerate}
                  >
                    {loadingRegenerate ? 'Removing...' : 'Remove Item'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* Post all to Slack button */}
        <div className={typedStyles.buttonGroup}>
          <button 
            onClick={handlePost} 
            disabled={loadingPost || loadingRegenerate}
            className={typedStyles.button}
          >
            {loadingPost ? 'Posting All to Slack...' : 'Post All to Slack'}
          </button>
          <button 
            onClick={handlePostExtractedOnly} 
            disabled={loadingPost || loadingRegenerate}
            className={typedStyles.button}
          >
            {loadingPost ? 'Posting...' : 'Post Items Only'}
          </button>
          <button 
            onClick={handlePostQuizVocabAsReplies} 
            disabled={loadingPost || loadingRegenerate}
            className={typedStyles.button}
          >
            {loadingPost ? 'Posting...' : 'Post Vocabulary and Quizzes as Replies'}
          </button>
        </div>
        
        {/* Post result */}
        {postResult && (
          <div className={typedStyles.result}>
            <h3>Posted to Slack</h3>
            <pre>{JSON.stringify(postResult, null, 2)}</pre>
          </div>
        )}
      </div>
    );
  };

  // Add handlers for removing quiz and vocabulary items
  const handleRemoveQuizQuestion = (category: keyof ExtractedContent, itemIndex: number, questionIndex: number) => {
    if (!editedContent || loadingRegenerate) return;
    
    const newContent = { ...editedContent };
    if (newContent[category][itemIndex].quiz) {
      newContent[category][itemIndex].quiz = newContent[category][itemIndex].quiz!.filter((_, i) => i !== questionIndex);
      setEditedContent(newContent);
    }
  };

  const handleRemoveVocabItem = (category: keyof ExtractedContent, itemIndex: number, vocabIndex: number) => {
    if (!editedContent || loadingRegenerate) return;
    
    const newContent = { ...editedContent };
    if (newContent[category][itemIndex].vocabulary) {
      newContent[category][itemIndex].vocabulary = newContent[category][itemIndex].vocabulary!.filter((_, i) => i !== vocabIndex);
      setEditedContent(newContent);
    }
  };

  const handleRegenerateItemContent = async (category: keyof ExtractedContent, index: number) => {
    if (!editedContent || loadingRegenerate) return;
    
    setLoadingRegenerate(true);
    
    try {
      const res = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_item',
          item: editedContent[category][index]
        }),
      });
      
      const data = await res.json();
      
      if (data.item) {
        const newContent = { ...editedContent };
        newContent[category][index] = data.item;
        setEditedContent(newContent);
      }
      
      setLoadingRegenerate(false);
    } catch (error) {
      console.error('Error regenerating item content:', error);
      alert('Error regenerating quiz and vocabulary for this item');
      setLoadingRegenerate(false);
    }
  };

  const handlePostSingleItem = async (category: keyof ExtractedContent, index: number) => {
    if (!editedContent || loadingPost) return;
    
    setLoadingPost(true);
    addLog(`Posting single ${category} item to Slack...`);
    
    try {
      const res = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_single_item',
          category: category,
          item: editedContent[category][index],
          channelId: selectedChannel
        }),
      });
      const data = await res.json();
      addLog(`Single item successfully posted to Slack`);
      setPostResult(data);
    } catch (error) {
      console.error(error);
      addLog(`Error posting single item: ${error}`);
      alert('Error posting single item to Slack');
    }
    setLoadingPost(false);
  };

  // Add function to render audio section
  const renderAudioSection = () => {
    if (!editedContent) return null;
    
    const newsItemsWithAudio = editedContent.news.filter(item => item.audioUrl);
    
    if (newsItemsWithAudio.length === 0) return null;
    
    return (
      <div className={typedStyles.audioSection}>
        <h4>Audio ({newsItemsWithAudio.length}):</h4>
        {newsItemsWithAudio.map((item, index) => (
          <div key={`audio-${index}`} className={typedStyles.audioItem}>
            <div className={typedStyles.audioTitle}>{item.title}</div>
            <audio controls className={typedStyles.audioPlayer}>
              <source src={item.audioUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
        ))}
      </div>
    );
  };

  // Updated pasted media preview with shortened URLs and audio section
  const renderPastedMediaPreview = () => {
    const hasMedia = pastedImages.length > 0 || pastedUrls.length > 0;
    const hasAudio = editedContent && editedContent.news.some(item => item.audioUrl);
    
    if (!hasMedia && !hasAudio) return null;
    
    return (
      <div className={typedStyles.pastedMediaPreview}>
        {pastedImages.length > 0 && (
          <div className={typedStyles.pastedImagesContainer}>
            <h4>Images ({pastedImages.length}):</h4>
            <div className={typedStyles.imageGrid}>
              {pastedImages.map((imgSrc, index) => (
                <div key={`img-${index}`} className={typedStyles.pastedImage}>
                  <img src={imgSrc} alt={`Image ${index + 1}`} />
                  <button 
                    className={typedStyles.removeButton} 
                    onClick={() => setPastedImages(prev => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {pastedUrls.length > 0 && (
          <div className={typedStyles.pastedUrlsContainer}>
            <h4>URLs ({pastedUrls.length}):</h4>
            <ul className={typedStyles.urlList}>
              {pastedUrls.map((url, index) => {
                // Shorten URL for display
                const displayUrl = url.length > 40 ? `${url.substring(0, 37)}...` : url;
                return (
                  <li key={`url-${index}`} className={typedStyles.urlItem}>
                    <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
                      {displayUrl}
                    </a>
                    <button 
                      className={typedStyles.removeButton} 
                      onClick={() => setPastedUrls(prev => prev.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        
        {/* Audio section */}
        {renderAudioSection()}
      </div>
    );
  };

  // Progress Bar Component
  const ProgressBar = ({ progress, status, isVisible }: { progress: number, status: string, isVisible: boolean }) => {
    if (!isVisible) return null;
    
    return (
      <div style={{
        margin: '16px 0',
        padding: '16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '500',
            color: '#495057'
          }}>
            {status}
          </span>
          <span style={{ 
            fontSize: '12px', 
            color: '#6c757d',
            fontWeight: '600'
          }}>
            {Math.round(progress)}%
          </span>
        </div>
        
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e9ecef',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: progress === 100 ? '#28a745' : '#007bff',
            transition: 'width 0.3s ease, background-color 0.3s ease',
            borderRadius: '4px'
          }} />
        </div>
        
        {progress === 100 && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#28a745',
            fontWeight: '500'
          }}>
            ✅ Extraction completed successfully!
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={typedStyles.container}>
      <main>
        <h1 className={typedStyles.title}>
          Slack Content Poster
        </h1>
        
        <ChannelSelector
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
        />
        
        <div className={typedStyles.threeColumnLayout}>
          {/* Left Sidebar - Media and Logs */}
          <div className={typedStyles.leftSidebar}>
            {renderPastedMediaPreview()}
            
            <div className={typedStyles.logsSection}>
              <h3>Processing Logs</h3>
              <LogDisplay logs={logs} />
            </div>
          </div>
          
          {/* Main Content */}
          <div className={typedStyles.mainContent}>
            {/* Collapsible Extract Container */}
            {(showTextarea || !isTextareaCollapsed) && (
              <div className={typedStyles.extractContainer}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Content Extraction</h3>
                  <button
                    onClick={() => setIsTextareaCollapsed(!isTextareaCollapsed)}
                    style={{
                      background: 'none',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {isTextareaCollapsed ? '▼ Expand' : '▲ Collapse'}
                  </button>
                </div>
                
                {!isTextareaCollapsed && (
                  <>
                    <textarea
                      className={typedStyles.extractTextarea}
                      placeholder="Paste content here (text, links, or images)..."
                      value={pastedText}
                      onChange={handlePastedTextChange}
                      onPaste={handlePaste}
                      rows={isTextareaCollapsed ? 3 : 6}
                      style={{ 
                        height: isTextareaCollapsed ? '80px' : '200px',
                        transition: 'height 0.3s ease'
                      }}
                    />
                    
                    <button
                      className={typedStyles.button}
                      onClick={handleExtract}
                      disabled={loadingExtract}
                    >
                      {loadingExtract ? (
                        <>
                          <span className={typedStyles.loadingSpinner}></span> Extracting...
                        </>
                      ) : (
                        'Extract Content'
                      )}
                    </button>
                  </>
                )}
                
                {/* Progress Bar */}
                <ProgressBar 
                  progress={extractionProgress} 
                  status={extractionStatus} 
                  isVisible={isExtracting} 
                />
              </div>
            )}
            
            {/* Floating extract button when textarea is hidden */}
            {!showTextarea && isTextareaCollapsed && (
              <div style={{
                position: 'fixed',
                top: '20px',
                right: '50%',
                transform: 'translateX(50%)',
                zIndex: 1000,
                padding: '8px 16px',
                backgroundColor: '#0070f3',
                color: 'white',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
              onClick={() => {
                setIsTextareaCollapsed(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              >
                📝 Add New Content
              </div>
            )}
            
            {/* Render extracted content if available */}
            {extractResult && renderExtractedContentForReview()}
          </div>
          
          {/* Right Sidebar - Quiz Report */}
          <div className={typedStyles.rightSidebar}>
            <QuizReportSidebar />
          </div>
        </div>
      </main>
    </div>
  );
}
