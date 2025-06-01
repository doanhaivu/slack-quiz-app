import { useState, useEffect, ChangeEvent } from 'react';
import styles from '../styles/Home.module.css';
import ChannelSelector from '../components/ChannelSelector';
import LogDisplay from '../components/LogDisplay';
import { QuizReportSidebar } from '../components/QuizReportSidebar/QuizReportSidebar';
import { ProgressBar } from '../components/ProgressBar/ProgressBar';
import { ThreeColumnLayout } from '../components/Layout/ThreeColumnLayout';
import { useContentExtraction } from '../hooks/useContentExtraction';
import { useMediaHandling } from '../hooks/useMediaHandling';
import { useLogs } from '../contexts/LogContext';

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

export default function Home() {
  const [isTextareaCollapsed, setIsTextareaCollapsed] = useState<boolean>(false);
  const [showTextarea, setShowTextarea] = useState<boolean>(true);
  
  const { logs, addLog } = useLogs();
  
  const {
    pastedText,
    setPastedText,
    pastedImages,
    setPastedImages,
    pastedUrls,
    setPastedUrls,
    loadingExtract,
    loadingPost,
    extractResult,
    postResult,
    editedContent,
    selectedChannel,
    setSelectedChannel,
    extractionProgress,
    extractionStatus,
    isExtracting,
    handleExtract,
    handlePost,
    handlePostExtractedOnly,
    handleRemoveItem,
    handleTitleChange,
    handleContentChange,
    handleUrlChange,
  } = useContentExtraction();

  const { handlePaste } = useMediaHandling(setPastedImages, setPastedUrls);
  
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

  const handlePastedTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setPastedText(e.target.value);
  };

  // Render media preview
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
        {editedContent && editedContent.news.filter(item => item.audioUrl).length > 0 && (
          <div className={typedStyles.audioSection}>
            <h4>Audio:</h4>
            {editedContent.news.filter(item => item.audioUrl).map((item, index) => (
              <div key={`audio-${index}`} className={typedStyles.audioItem}>
                <div className={typedStyles.audioTitle}>{item.title}</div>
                <audio controls className={typedStyles.audioPlayer}>
                  <source src={item.audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Simplified content review renderer - will be extracted to its own component later
  const renderExtractedContentForReview = () => {
    if (!editedContent) return null;
    
    return (
      <div className={typedStyles.extractedContent}>
        <h3>Review and Edit Extracted Content</h3>
        
        {/* News Items */}
        {editedContent.news && editedContent.news.length > 0 && (
          <>
            <h3 className={typedStyles.categoryHeading}>News</h3>
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
                
                <div className={typedStyles.itemActions}>
                  <button 
                    className={typedStyles.removeButton}
                    onClick={() => handleRemoveItem('news', index)}
                  >
                    Remove Item
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* Tools and Prompts - simplified version */}
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
                <div className={typedStyles.itemActions}>
                  <button 
                    className={typedStyles.removeButton}
                    onClick={() => handleRemoveItem('tools', index)}
                  >
                    Remove Item
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        
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
                <div className={typedStyles.itemActions}>
                  <button 
                    className={typedStyles.removeButton}
                    onClick={() => handleRemoveItem('prompts', index)}
                  >
                    Remove Item
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* Post buttons */}
        <div className={typedStyles.buttonGroup}>
          <button 
            onClick={handlePost} 
            disabled={loadingPost}
            className={typedStyles.button}
          >
            {loadingPost ? 'Posting All to Slack...' : 'Post All to Slack'}
          </button>
          <button 
            onClick={handlePostExtractedOnly} 
            disabled={loadingPost}
            className={typedStyles.button}
          >
            {loadingPost ? 'Posting...' : 'Post Items Only'}
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

  // Left sidebar content
  const leftSidebar = (
    <>
      {renderPastedMediaPreview()}
      <div style={{ marginTop: '20px' }}>
        <h3>Processing Logs</h3>
        <LogDisplay logs={logs} />
      </div>
    </>
  );

  // Main content
  const mainContent = (
    <>
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
                rows={6}
                style={{ height: '200px' }}
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
    </>
  );

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
        
        <ThreeColumnLayout
          leftSidebar={leftSidebar}
          mainContent={mainContent}
          rightSidebar={<QuizReportSidebar />}
        />
      </main>
    </div>
  );
} 