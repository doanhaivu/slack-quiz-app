import { useState, useEffect } from 'react';
import { ExtractedItem } from '../types';

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

export const useContentExtraction = () => {
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
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [extractionStatus, setExtractionStatus] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  // Update edited content whenever extract result changes
  useEffect(() => {
    if (extractResult && extractResult.extractedContent) {
      setEditedContent(JSON.parse(JSON.stringify(extractResult.extractedContent)));
    }
  }, [extractResult]);

  const handleExtract = async () => {
    if (!pastedText.trim() && pastedImages.length === 0 && pastedUrls.length === 0) {
      alert('Please paste some content first');
      return;
    }
    
    setLoadingExtract(true);
    setIsExtracting(true);
    setExtractionProgress(10);
    setExtractionStatus('Starting extraction...');
    
    try {
      setExtractionProgress(30);
      setExtractionStatus('Processing content...');
      
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: pastedText,
          images: pastedImages,
          urls: pastedUrls
        }),
      });
      
      setExtractionProgress(70);
      setExtractionStatus('Parsing results...');
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract content');
      }
      
      setExtractionProgress(100);
      setExtractionStatus('Extraction complete!');
      setExtractResult(data);
      
      // Clear the extraction progress after a brief delay
      setTimeout(() => {
        setIsExtracting(false);
        setExtractionProgress(0);
        setExtractionStatus('');
      }, 1000);
      
    } catch (error) {
      console.error('Error extracting content:', error);
      alert(error instanceof Error ? error.message : 'Failed to extract content');
      setIsExtracting(false);
      setExtractionProgress(0);
      setExtractionStatus('');
    } finally {
      setLoadingExtract(false);
    }
  };

  const handlePost = async () => {
    if (!editedContent) {
      alert('No content to post. Please extract content first.');
      return;
    }
    
    setLoadingPost(true);
    try {
      const response = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'post',
          extractedContent: editedContent,
          channelId: selectedChannel
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to post content');
      }
      
      setPostResult(data);
      alert('Content posted to Slack successfully!');
    } catch (error) {
      console.error('Error posting content:', error);
      alert(error instanceof Error ? error.message : 'Failed to post content');
    } finally {
      setLoadingPost(false);
    }
  };

  const handlePostExtractedOnly = async () => {
    if (!editedContent) {
      alert('No content to post. Please extract content first.');
      return;
    }
    
    setLoadingPost(true);
    try {
      const response = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'post_extracted_only',
          extractedContent: editedContent,
          images: pastedImages,
          urls: pastedUrls,
          channelId: selectedChannel
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to post content');
      }
      
      setPostResult(data);
      alert('Content posted to Slack successfully!');
    } catch (error) {
      console.error('Error posting content:', error);
      alert(error instanceof Error ? error.message : 'Failed to post content');
    } finally {
      setLoadingPost(false);
    }
  };

  const handlePostQuizVocabAsReplies = async () => {
    if (!editedContent || loadingPost) return;
    
    setLoadingPost(true);
    console.log('Posting vocabulary and quizzes as replies to Slack...');
    
    try {
      const response = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_quiz_vocab_as_replies',
          extractedContent: editedContent,
          channelId: selectedChannel
        }),
      });
      const data = await response.json();
      
      console.log('Vocabulary and quizzes successfully posted as replies');
      setPostResult(data);
      alert('Vocabulary and quizzes posted as replies successfully!');
    } catch (error) {
      console.error(error);
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
    
    // Set loading state to false after a brief delay
    setTimeout(() => {
      setLoadingRegenerate(false);
    }, 500);
  };

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
      const response = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_item',
          item: editedContent[category][index]
        }),
      });
      
      const data = await response.json();
      
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
    console.log(`Posting single ${category} item to Slack...`);
    
    try {
      const response = await fetch('/api/parse-and-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'post_single_item',
          category: category,
          item: editedContent[category][index],
          channelId: selectedChannel
        }),
      });
      const data = await response.json();
      console.log(`Single item successfully posted to Slack`);
      setPostResult(data);
      alert(`${category} item posted to Slack successfully!`);
    } catch (error) {
      console.error(error);
      alert('Error posting single item to Slack');
    }
    setLoadingPost(false);
  };

  return {
    // State
    pastedText,
    setPastedText,
    pastedImages,
    setPastedImages,
    pastedUrls,
    setPastedUrls,
    loadingExtract,
    loadingPost,
    loadingRegenerate,
    extractResult,
    postResult,
    editedContent,
    setEditedContent,
    selectedChannel,
    setSelectedChannel,
    extractionProgress,
    extractionStatus,
    isExtracting,
    
    // Actions
    handleExtract,
    handlePost,
    handlePostExtractedOnly,
    handlePostQuizVocabAsReplies,
    handleRemoveItem,
    handleTitleChange,
    handleContentChange,
    handleUrlChange,
    handleRemoveQuizQuestion,
    handleRemoveVocabItem,
    handleRegenerateItemContent,
    handlePostSingleItem,
  };
}; 