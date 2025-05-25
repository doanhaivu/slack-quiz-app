// pages/index.tsx
import { useState, ChangeEvent, FormEvent, useEffect, ClipboardEvent } from 'react';
import styles from '../styles/Home.module.css';
import ChannelSelector from '../components/ChannelSelector';
import LogDisplay from '../components/LogDisplay';
import { useLogs } from '../contexts/LogContext';
import Link from 'next/link';

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
}

// Type assertion for styles import
const typedStyles = styles as Styles;

interface FormData {
  title: string;
  summary: string;
  url: string;
  pictureUrl: string;
  category: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

interface VocabularyItem {
  term: string;
  definition: string;
}

interface ResultData {
  title: string;
  summary: string;
  url: string | null;
  pictureUrl: string | null;
  category: string;
  quiz: QuizQuestion[];
  vocabulary: VocabularyItem[];
  slackMessageId: string;
}

interface ExtractedItem {
  category: 'news' | 'tools' | 'prompts';
  title: string;
  content: string;
  url?: string;
  quiz?: QuizQuestion[];
  vocabulary?: VocabularyItem[];
  slackMessageId?: string;
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
  const [formData, setFormData] = useState<FormData>({
    title: '',
    summary: '',
    url: '',
    pictureUrl: '',
    category: 'news',
  });
  const [pastedText, setPastedText] = useState<string>('');
  const [pastedImages, setPastedImages] = useState<string[]>([]);
  const [pastedUrls, setPastedUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingExtract, setLoadingExtract] = useState<boolean>(false);
  const [loadingPost, setLoadingPost] = useState<boolean>(false);
  const [loadingRegenerate, setLoadingRegenerate] = useState<boolean>(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [postResult, setPostResult] = useState<PostResult | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'extract'>('extract');
  const [editedContent, setEditedContent] = useState<ExtractedContent | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string>('C08ST272AAG'); // Default channel
  
  const { logs, addLog, clearLogs } = useLogs();
  
  // Update edited content whenever extract result changes
  useEffect(() => {
    if (extractResult && extractResult.extractedContent) {
      setEditedContent(JSON.parse(JSON.stringify(extractResult.extractedContent)));
    }
  }, [extractResult]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert('Error generating content');
    }
    setLoading(false);
  };

  const handleExtract = async () => {
    if (!pastedText.trim() && pastedImages.length === 0 && pastedUrls.length === 0) {
      alert('Please paste some content first');
      return;
    }
    
    setLoadingExtract(true);
    setExtractResult(null);
    setPostResult(null);
    clearLogs();
    
    addLog('Starting content extraction...');
    addLog(`Processing paste with ${pastedUrls.length} URLs and ${pastedImages.length} images`);
    
    try {
      // Improve logging for debugging image issues
      addLog(`Sending ${pastedImages.length} images and ${pastedUrls.length} URLs to API`);
      if (pastedImages.length > 0) {
        addLog(`First image preview: ${pastedImages[0].substring(0, 30)}...`);
      }
      
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
      const data = await res.json();
      
      addLog('Extraction completed successfully');
      if (data.extractedContent) {
        addLog(`Found ${data.extractedContent.news?.length || 0} news items, ${data.extractedContent.tools?.length || 0} tools, and ${data.extractedContent.prompts?.length || 0} prompts`);
      }
      
      setExtractResult(data);
    } catch (error) {
      console.error('Error extracting content:', error);
      addLog(`Error extracting content: ${error}`);
      alert('Error extracting content');
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

  // Add preview section for images and links
  const renderPastedMediaPreview = () => {
    if (pastedImages.length === 0 && pastedUrls.length === 0) return null;
    
    return (
      <div className={typedStyles.pastedMediaPreview}>
        {pastedImages.length > 0 && (
          <div className={typedStyles.pastedImagesContainer}>
            <h4>Pasted Images:</h4>
            <div className={typedStyles.imageGrid}>
              {pastedImages.map((imgSrc, index) => (
                <div key={`img-${index}`} className={typedStyles.pastedImage}>
                  <img src={imgSrc} alt={`Pasted image ${index + 1}`} />
                  <button 
                    className={typedStyles.removeButton} 
                    onClick={() => setPastedImages(prev => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {pastedUrls.length > 0 && (
          <div className={typedStyles.pastedUrlsContainer}>
            <h4>Detected URLs:</h4>
            <ul className={typedStyles.urlList}>
              {pastedUrls.map((url, index) => (
                <li key={`url-${index}`} className={typedStyles.urlItem}>
                  <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
                  <button 
                    className={typedStyles.removeButton} 
                    onClick={() => setPastedUrls(prev => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
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
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
          <Link href="/quizzes" style={{ textDecoration: 'underline', color: '#0070f3' }}>
            View Quiz Library
          </Link>
          <Link href="/quiz-report" style={{ textDecoration: 'underline', color: '#0070f3' }}>
            View Quiz Performance Report
          </Link>
        </div>
        
        <ChannelSelector
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
        />
        
        <div className={typedStyles.tabs}>
          <button
            className={`${typedStyles.tabButton} ${activeTab === 'extract' ? typedStyles.activeTab : ''}`}
            onClick={() => setActiveTab('extract')}
          >
            Extract from Text
          </button>
          <button
            className={`${typedStyles.tabButton} ${activeTab === 'manual' ? typedStyles.activeTab : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            Manual Entry
          </button>
        </div>
        
        <div className={typedStyles.twoColumnLayout}>
          <div className={typedStyles.logsColumn}>
            <h3>Processing Logs</h3>
            <LogDisplay logs={logs} />
          </div>
          
          <div className={typedStyles.mainColumn}>
            {activeTab === 'extract' ? (
              <div className={typedStyles.extractContainer}>
                <textarea
                  className={typedStyles.extractTextarea}
                  placeholder="Paste content here (text, links, or images)..."
                  value={pastedText}
                  onChange={handlePastedTextChange}
                  onPaste={handlePaste}
                  rows={10}
                />
                
                {/* Render pasted media preview if available */}
                {renderPastedMediaPreview()}
                
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
                
                {/* Render extracted content if available */}
                {extractResult && renderExtractedContentForReview()}
                {/* ... existing result actions ... */}
              </div>
            ) : (
              <form className={typedStyles.form} onSubmit={handleSubmit}>
                <label className={typedStyles.label}>
                  Title:
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className={typedStyles.input}
                  />
                </label>
                <label className={typedStyles.label}>
                  Summary:
                  <textarea
                    name="summary"
                    value={formData.summary}
                    onChange={handleChange}
                    required
                    className={typedStyles.textarea}
                  />
                </label>
                <label className={typedStyles.label}>
                  URL:
                  <input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleChange}
                    className={typedStyles.input}
                  />
                </label>
                <label className={typedStyles.label}>
                  Picture URL:
                  <input
                    type="url"
                    name="pictureUrl"
                    value={formData.pictureUrl}
                    onChange={handleChange}
                    className={typedStyles.input}
                  />
                </label>
                <label className={typedStyles.label}>
                  Category:
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={typedStyles.select}
                  >
                    <option value="news">News</option>
                    <option value="tools">Tools</option>
                    <option value="prompt">Prompt</option>
                  </select>
                </label>
                <button type="submit" disabled={loading} className={typedStyles.button}>
                  {loading ? 'Generating...' : 'Generate & Post to Slack'}
                </button>
                
                {result && (
                  <div className={typedStyles.result}>
                    <h2>Generated Content</h2>
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  </div>
                )}
              </form>
            )}
            
            {/* ... existing result display and post results ... */}
          </div>
        </div>
      </main>
    </div>
  );
}
