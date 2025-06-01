import { SLACK_CHANNEL_ID } from '../../constants';
import { SlackMessageData, VocabularyItem, QuizQuestion } from '../../types';
import { getSlackClient } from './client';
import { uploadImageToSlack, uploadAudioToSlack } from './file-handler';
import { buildMessageBlocks, buildVocabularyReplyBlocks, buildQuizReplyBlocks } from './message-builder';
import { ChatPostMessageResponse } from '@slack/web-api';

/**
 * Post a message to Slack with optional image and audio
 */
export async function postToSlack(
  messageData: SlackMessageData, 
  channelId: string = SLACK_CHANNEL_ID
): Promise<ChatPostMessageResponse> {
  const { title, summary, url, pictureUrl, audioUrl, category, quiz, vocabulary } = messageData;
  const slack = getSlackClient();
  
  // Log image status
  const hasImage = pictureUrl !== null && pictureUrl !== undefined && pictureUrl !== '';
  console.log(`Posting to Slack with image: ${hasImage ? 'yes' : 'no'}`);
  
  // Build message blocks
  const blocks = buildMessageBlocks(title, summary, category, url, vocabulary, quiz);
  
  // Post the text message first
  const response = await slack.chat.postMessage({
    channel: channelId,
    blocks,
    text: `New ${category}: ${title}`, // Fallback text
  });

  // Handle image upload
  if (hasImage && pictureUrl && response.ts) {
    await uploadImageToSlack(pictureUrl, channelId);
  }

  // Handle audio upload
  if (audioUrl && response.ts) {
    await uploadAudioToSlack(audioUrl, channelId, title);
  }

  return response;
}

/**
 * Post vocabulary as a reply to a news item
 */
export async function postVocabularyAsReply(
  vocabulary: VocabularyItem[], 
  parentMessageId: string, 
  channelId: string = SLACK_CHANNEL_ID
): Promise<ChatPostMessageResponse | undefined> {
  if (!vocabulary || vocabulary.length === 0) {
    return;
  }
  
  const slack = getSlackClient();
  const blocks = buildVocabularyReplyBlocks(vocabulary);
  
  // Post as a thread reply
  const response = await slack.chat.postMessage({
    channel: channelId,
    thread_ts: parentMessageId,
    blocks,
    text: "Key terminology for this news item",
  });
  
  return response;
}

/**
 * Post quiz questions as a reply to a news item
 */
export async function postQuizAsReply(
  quiz: QuizQuestion[], 
  parentMessageId: string, 
  channelId: string = SLACK_CHANNEL_ID
): Promise<ChatPostMessageResponse | undefined> {
  if (!quiz || quiz.length === 0) {
    return;
  }
  
  const slack = getSlackClient();
  const blocks = buildQuizReplyBlocks(quiz);
  
  // Post as a thread reply
  const response = await slack.chat.postMessage({
    channel: channelId,
    thread_ts: parentMessageId,
    blocks,
    text: "Quiz questions for this news item",
  });
  
  return response;
}

/**
 * Post a quiz-only message to Slack
 */
export async function postQuizToSlack(
  messageData: SlackMessageData, 
  channelId: string = SLACK_CHANNEL_ID
): Promise<ChatPostMessageResponse> {
  const { title, summary, quiz, pictureUrl } = messageData;
  const slack = getSlackClient();
  
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🧠 *${title}*\n${summary}`,
      }
    },
    { type: 'divider' },
    ...buildQuizReplyBlocks(quiz || [])
  ];

  // Post the text message first
  const response = await slack.chat.postMessage({
    channel: channelId,
    blocks,
    text: `Quiz: ${title}`, // Fallback text
  });

  // Handle image upload
  if (pictureUrl && response.ts) {
    await uploadImageToSlack(pictureUrl, channelId, `📷 Image for "${title}"`);
  }

  return response;
} 