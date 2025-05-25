// Define interfaces for the application

// ExtractedItem interface
export interface ExtractedItem {
  category: 'news' | 'tools' | 'prompts';
  title: string;
  content: string;
  url?: string;
  imageUrl?: string;
  audioUrl?: string;
  quiz?: QuizQuestion[];
  vocabulary?: VocabularyItem[];
  slackMessageId?: string;
}

// Quiz question interface
export interface QuizQuestion {
  question: string;
  options: string[];
  correct: string;
}

// Vocabulary item interface
export interface VocabularyItem {
  term: string;
  definition: string;
}

// Slack message data interface
export interface SlackMessageData {
  title: string;
  summary: string;
  url: string | null;
  pictureUrl: string | null;
  audioUrl?: string | null;
  category: string;
  quiz?: QuizQuestion[];
  vocabulary?: VocabularyItem[];
  slackMessageId?: string;
}

// Slack block interfaces
export interface SlackBlockText {
  type: string;
  text: string;
}

export interface SlackBlockOption {
  text: { type: string; text: string };
  value: string;
}

export interface SlackBlockAccessory {
  type: string;
  placeholder: { type: string; text: string };
  options: SlackBlockOption[];
  action_id: string;
}

export interface SlackContextElement {
  type: string;
  text: string;
}

export interface SlackImageBlock {
  type: 'image';
  image_url: string;
  alt_text: string;
}

export interface SlackBlock {
  type: string;
  text?: SlackBlockText;
  accessory?: SlackBlockAccessory;
  elements?: SlackContextElement[];
  image_url?: string;
  alt_text?: string;
}

// Text to speech options interface
export interface TextToSpeechOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
} 