import { useState, useEffect } from 'react';
import { ExtractedItem, PostResult } from '../types';

interface ExtractedContent {
  news: ExtractedItem[];
  tools: ExtractedItem[];
  prompts: ExtractedItem[];
}



export function useContentExtraction() {
  const [pastedText, setPastedText] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [loadingExtract, setLoadingExtract] = useState<boolean>(false);
  const [loadingPost, setLoadingPost] = useState<boolean>(false);
  const [loadingRegenerate, setLoadingRegenerate] = useState<boolean>(false);
  const [pastedImages, setPastedImages] = useState<string[]>([]);
  const [pastedUrls, setPastedUrls] = useState<string[]>([]);
  const [extractResult, setExtractResult] = useState<{ extractedContent: ExtractedContent } | null>(null);
  const [editedContent, setEditedContent] = useState<ExtractedContent | null>(null);
  const [postResult, setPostResult] = useState<PostResult | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<number>(0);
  const [extractionStatus, setExtractionStatus] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

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
    if (!editedContent || Object.keys(editedContent).length === 0) {
      setError('No content to post');
      return;
    }

    setLoadingPost(true);
    setError('');

    try {
      const response = await fetch('/api/slack/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extractedContent: editedContent,
          channelId: selectedChannel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post content');
      }

      setPostResult(data);
      alert('Content posted to Slack successfully!');
    } catch (err) {
      console.error('Error posting to Slack:', err);
      setError(err instanceof Error ? err.message : 'Failed to post to Slack');
    } finally {
      setLoadingPost(false);
    }
  };

  const handlePostExtractedOnly = async () => {
    if (!editedContent || Object.keys(editedContent).length === 0) {
      setError('No content to post');
      return;
    }

    setLoadingPost(true);
    setError('');

    try {
      const response = await fetch('/api/slack/post-extracted', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extractedContent: editedContent,
          images: pastedImages,
          urls: pastedUrls,
          channelId: selectedChannel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post content');
      }

      // Update the extracted content with any message IDs from the response
      if (data.extractedContent) {
        setEditedContent(data.extractedContent);
      }

      setPostResult(data);
      alert('Extracted items posted to Slack successfully!');
    } catch (err) {
      console.error('Error posting extracted content:', err);
      setError(err instanceof Error ? err.message : 'Failed to post extracted content');
    } finally {
      setLoadingPost(false);
    }
  };

  const handlePostQuizVocabAsReplies = async () => {
    if (!editedContent || !editedContent.news || editedContent.news.length === 0) {
      setError('No news content with quiz/vocabulary to post');
      return;
    }

    setLoadingPost(true);
    setError('');

    try {
      const response = await fetch('/api/slack/post-quiz-vocab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extractedContent: editedContent,
          channelId: selectedChannel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post quiz/vocabulary as replies');
      }

      setPostResult(data);
      alert('Quiz and vocabulary posted as replies successfully!');
    } catch (err) {
      console.error('Error posting quiz/vocab as replies:', err);
      setError(err instanceof Error ? err.message : 'Failed to post quiz/vocabulary as replies');
    } finally {
      setLoadingPost(false);
    }
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
    setError('');

    try {
      const item = editedContent[category][index];
      if (!item) {
        throw new Error('Item not found');
      }

      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate content');
      }
      
      // Update the item with regenerated content
      if (data.item && editedContent) {
        const updatedContent = { ...editedContent };
        updatedContent[category][index] = data.item;
        setEditedContent(updatedContent);
      }
    } catch (err) {
      console.error('Error regenerating content:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate content');
    } finally {
      setLoadingRegenerate(false);
    }
  };

  const handlePostSingleItem = async (category: keyof ExtractedContent, index: number) => {
    if (!editedContent || loadingPost) return;
    
    setLoadingPost(true);
    setError('');

    try {
      const item = editedContent[category][index];
      if (!item) {
        throw new Error('Item not found');
      }

      const response = await fetch('/api/content/post-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: category,
          item: item,
          channelId: selectedChannel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post item');
      }

      alert(`${category} item posted to Slack successfully!`);
    } catch (err) {
      console.error('Error posting single item:', err);
      setError(err instanceof Error ? err.message : 'Failed to post item');
    } finally {
      setLoadingPost(false);
    }
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
    error,
    
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
} 