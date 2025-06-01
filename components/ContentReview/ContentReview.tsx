import { ExtractedItem, QuizQuestion, VocabularyItem } from '../../types';

interface ExtractedContent {
  news: ExtractedItem[];
  tools: ExtractedItem[];
  prompts: ExtractedItem[];
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

interface StylesType {
  extractedContent: string;
  categoryHeading: string;
  itemCard: string;
  editableTitle: string;
  editableContent: string;
  input: string;
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
  removeButton: string;
  itemActions: string;
  regenerateButton: string;
  postButton: string;
  buttonGroup: string;
  button: string;
  result: string;
}

interface ContentReviewProps {
  editedContent: ExtractedContent | null;
  postResult: PostResult | null;
  loadingPost: boolean;
  loadingRegenerate: boolean;
  onTitleChange: (category: keyof ExtractedContent, index: number, value: string) => void;
  onContentChange: (category: keyof ExtractedContent, index: number, value: string) => void;
  onUrlChange: (category: keyof ExtractedContent, index: number, value: string) => void;
  onRemoveItem: (category: keyof ExtractedContent, index: number) => void;
  onRemoveQuizQuestion: (category: keyof ExtractedContent, itemIndex: number, questionIndex: number) => void;
  onRemoveVocabItem: (category: keyof ExtractedContent, itemIndex: number, vocabIndex: number) => void;
  onRegenerateItemContent: (category: keyof ExtractedContent, index: number) => void;
  onPostSingleItem: (category: keyof ExtractedContent, index: number) => void;
  onPost: () => void;
  onPostExtractedOnly: () => void;
  onPostQuizVocabAsReplies: () => void;
  styles: StylesType;
}

export const ContentReview = ({
  editedContent,
  postResult,
  loadingPost,
  loadingRegenerate,
  onTitleChange,
  onContentChange,
  onUrlChange,
  onRemoveItem,
  onRemoveQuizQuestion,
  onRemoveVocabItem,
  onRegenerateItemContent,
  onPostSingleItem,
  onPost,
  onPostExtractedOnly,
  onPostQuizVocabAsReplies,
  styles
}: ContentReviewProps) => {
  if (!editedContent) return null;

  const renderQuizSection = (item: ExtractedItem, category: keyof ExtractedContent, itemIndex: number) => {
    if (!item.quiz || item.quiz.length === 0) return null;

    return (
      <div className={styles.itemQuizSection}>
        <h4 className={styles.itemSectionTitle}>📝 Quiz Questions</h4>
        {item.quiz.map((question: QuizQuestion, qIndex: number) => (
          <div key={`quiz-${itemIndex}-${qIndex}`} className={styles.quizItem}>
            <p className={styles.questionText}><strong>Q{qIndex + 1}:</strong> {question.question}</p>
            <div className={styles.optionsContainer}>
              {question.options.map((option: string, oIndex: number) => (
                <div key={`option-${itemIndex}-${qIndex}-${oIndex}`} className={styles.optionItem}>
                  <span className={option === question.correct ? styles.correctOption : ''}>{option}</span>
                  {option === question.correct && <span className={styles.correctIndicator}>✓</span>}
                </div>
              ))}
            </div>
            <button 
              className={styles.removeButton}
              onClick={() => onRemoveQuizQuestion(category, itemIndex, qIndex)}
              disabled={loadingRegenerate}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderVocabularySection = (item: ExtractedItem, category: keyof ExtractedContent, itemIndex: number) => {
    if (!item.vocabulary || item.vocabulary.length === 0) return null;

    return (
      <div className={styles.itemVocabSection}>
        <h4 className={styles.itemSectionTitle}>📚 Vocabulary</h4>
        {item.vocabulary.map((vocabItem: VocabularyItem, vIndex: number) => (
          <div key={`vocab-${itemIndex}-${vIndex}`} className={styles.vocabItem}>
            <span className={styles.vocabTerm}>{vocabItem.term}:</span>
            <span className={styles.vocabDefinition}>{vocabItem.definition}</span>
            <button 
              className={styles.removeButton}
              onClick={() => onRemoveVocabItem(category, itemIndex, vIndex)}
              disabled={loadingRegenerate}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderItemActions = (category: keyof ExtractedContent, index: number) => {
    const isNews = category === 'news';
    const regenerateText = isNews ? 'Regenerate Quiz & Vocab' : 'Regenerate Vocabulary';

    return (
      <div className={styles.itemActions}>
        <button 
          className={styles.regenerateButton}
          onClick={() => onRegenerateItemContent(category, index)}
          disabled={loadingRegenerate}
        >
          {regenerateText}
        </button>
        <button 
          className={styles.postButton}
          onClick={() => onPostSingleItem(category, index)}
          disabled={loadingPost}
        >
          Post to Slack
        </button>
        <button 
          className={styles.removeButton}
          onClick={() => onRemoveItem(category, index)}
          disabled={loadingRegenerate}
        >
          {loadingRegenerate ? 'Removing...' : 'Remove Item'}
        </button>
      </div>
    );
  };

  const renderCategoryItems = (items: ExtractedItem[], category: keyof ExtractedContent, title: string) => {
    if (!items || items.length === 0) return null;

    return (
      <>
        <h3 className={styles.categoryHeading}>{title}</h3>
        {items.map((item, index) => (
          <div key={`${category}-${index}`} className={styles.itemCard}>
            <input
              type="text"
              value={item.title}
              onChange={(e) => onTitleChange(category, index, e.target.value)}
              className={styles.editableTitle}
              placeholder="Title"
            />
            <textarea
              value={item.content}
              onChange={(e) => onContentChange(category, index, e.target.value)}
              className={styles.editableContent}
              placeholder="Content"
              rows={3}
            />
            <input
              type="url"
              value={item.url || ''}
              onChange={(e) => onUrlChange(category, index, e.target.value)}
              className={styles.input}
              placeholder="URL (optional)"
            />
            
            {/* Quiz section (only for news items) */}
            {category === 'news' && renderQuizSection(item, category, index)}
            
            {/* Vocabulary section (for all categories) */}
            {renderVocabularySection(item, category, index)}
            
            {/* Item actions */}
            {renderItemActions(category, index)}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className={styles.extractedContent}>
      <h3>Review and Edit Extracted Content</h3>
      
      {/* News Items */}
      {renderCategoryItems(editedContent.news, 'news', 'News Items')}
      
      {/* Tools Items */}
      {renderCategoryItems(editedContent.tools, 'tools', 'Tools')}
      
      {/* Prompts Items */}
      {renderCategoryItems(editedContent.prompts, 'prompts', 'Prompts')}
      
      {/* Post buttons */}
      <div className={styles.buttonGroup}>
        <button 
          onClick={onPost} 
          disabled={loadingPost || loadingRegenerate}
          className={styles.button}
        >
          {loadingPost ? 'Posting All to Slack...' : 'Post All to Slack'}
        </button>
        <button 
          onClick={onPostExtractedOnly} 
          disabled={loadingPost || loadingRegenerate}
          className={styles.button}
        >
          {loadingPost ? 'Posting...' : 'Post Items Only'}
        </button>
        <button 
          onClick={onPostQuizVocabAsReplies} 
          disabled={loadingPost || loadingRegenerate}
          className={styles.button}
        >
          {loadingPost ? 'Posting...' : 'Post Vocabulary and Quizzes as Replies'}
        </button>
      </div>
      
      {/* Post result */}
      {postResult && (
        <div className={styles.result}>
          <h3>Posted to Slack</h3>
          <pre>{JSON.stringify(postResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}; 