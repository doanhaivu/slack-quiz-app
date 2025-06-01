import { SlackBlock, VocabularyItem, QuizQuestion } from '../../types';

/**
 * Generate a catchy heading with emoji based on category
 */
export function generateHeading(title: string, category: string): string {
  if (category === 'news') {
    return `📰 *${title}!*`;
  } else if (category === 'tools') {
    return `🛠️ *Cool Tool Alert: ${title}*`;
  } else if (category === 'prompts') {
    return `✨ *Prompt Magic: ${title}*`;
  }
  return `*${title}*`;
}

/**
 * Build the main content section block
 */
export function buildContentSection(
  heading: string,
  summary: string,
  url?: string | null
): SlackBlock {
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${heading}\n${summary}${url ? `\n<${url}|Read more>` : ''}`,
    }
  };
}

/**
 * Build vocabulary blocks
 */
export function buildVocabularyBlocks(vocabulary: VocabularyItem[]): SlackBlock[] {
  if (!vocabulary || vocabulary.length === 0) return [];
  
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*🔍 Key Terminology*' },
    }
  ];
  
  vocabulary.forEach(v => {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `• *${v.term}*: ${v.definition}` },
    });
  });
  
  blocks.push({ type: 'divider' });
  
  return blocks;
}

/**
 * Build quiz question blocks
 */
export function buildQuizBlocks(quiz: QuizQuestion[]): SlackBlock[] {
  if (!quiz || quiz.length === 0) return [];
  
  const blocks: SlackBlock[] = [];
  
  // Add each quiz question
  quiz.forEach((q, index) => {
    // Truncate options to prevent Slack API errors (75 char limit for options)
    const truncatedOptions = q.options.map(opt => 
      opt.length > 75 ? opt.substring(0, 72) + '...' : opt
    );
    
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Q${index + 1}: ${q.question}*` },
      accessory: {
        type: 'static_select',
        placeholder: { type: 'plain_text', text: 'Choose an answer' },
        options: truncatedOptions.map((opt) => ({
          text: { type: 'plain_text', text: opt },
          value: opt,
        })),
        action_id: `quiz_answer_${index}`,
      },
    } as SlackBlock);
  });
  
  // Add a note about responses being private
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: "_Your answers will be visible only to you_"
      }
    ]
  } as SlackBlock);
  
  return blocks;
}

/**
 * Build complete message blocks for a post
 */
export function buildMessageBlocks(
  title: string,
  summary: string,
  category: string,
  url?: string | null,
  vocabulary?: VocabularyItem[],
  quiz?: QuizQuestion[]
): SlackBlock[] {
  const heading = generateHeading(title, category);
  
  const blocks: SlackBlock[] = [
    buildContentSection(heading, summary, url),
    { type: 'divider' }
  ];
  
  // Add vocabulary if available
  blocks.push(...buildVocabularyBlocks(vocabulary || []));
  
  // Add quiz if available
  blocks.push(...buildQuizBlocks(quiz || []));
  
  return blocks;
}

/**
 * Build reply blocks for vocabulary
 */
export function buildVocabularyReplyBlocks(vocabulary: VocabularyItem[]): SlackBlock[] {
  return [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*📚 Key Terminology*' },
    },
    ...vocabulary.map(v => ({
      type: 'section',
      text: { type: 'mrkdwn', text: `• *${v.term}*: ${v.definition}` },
    } as SlackBlock))
  ];
}

/**
 * Build reply blocks for quiz
 */
export function buildQuizReplyBlocks(quiz: QuizQuestion[]): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*🧠 Test Your Knowledge!*' },
    }
  ];
  
  blocks.push(...buildQuizBlocks(quiz));
  
  return blocks;
} 