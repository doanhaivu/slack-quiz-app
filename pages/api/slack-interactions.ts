import { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import { getQuizBySlackMessageId } from '../../utils/quizzes';
import { saveQuizResponse } from '../../utils/responses';
import fs from 'fs/promises';
import path from 'path';

// Configure Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Define types for Slack interaction payloads
interface SlackActionPayload {
  type: string;
  user: {
    id: string;
    username: string;
    name: string;
  };
  channel: {
    id: string;
    name: string;
  };
  message: {
    ts: string;
    text: string;
    blocks: SlackBlock[];
  };
  actions: SlackAction[];
  response_url: string;
  trigger_id: string;
  team: {
    id: string;
    domain: string;
  };
}

interface SlackAction {
  action_id: string;
  block_id: string;
  type: string;
  selected_option?: {
    text: {
      type: string;
      text: string;
    };
    value: string;
  };
  value?: string;
}

interface SlackBlock {
  type: string;
  block_id: string;
  text?: {
    type: string;
    text: string;
    verbatim?: boolean;
  };
  accessory?: {
    type: string;
    action_id: string;
    [key: string]: any;
  };
  elements?: Array<{
    type: string;
    [key: string]: any;
  }>;
}

// Define the QuizResponse type
interface QuizResponse {
  userId: string;
  quizId: string;
  questionIndex: number;
  question: string;
  answer: string;
  isCorrect: boolean;
  timestamp: string;
}

// Parse and handle Slack interaction payloads
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Slack sends the payload as a URL-encoded string
    let payload: SlackActionPayload;
    
    // Check if payload comes directly or in the request body
    if (req.body.payload) {
      // Format when forwarded from our redirect endpoint or when Slack sends as application/x-www-form-urlencoded
      payload = JSON.parse(req.body.payload) as SlackActionPayload;
    } else if (typeof req.body === 'object') {
      // Direct JSON format
      payload = req.body as SlackActionPayload;
    } else {
      throw new Error('Invalid request format');
    }
    
    console.log('📦 SLACK PAYLOAD: Received interaction from:', {
      userId: payload.user?.id,
      username: payload.user?.username,
      name: payload.user?.name,
      teamId: payload.team?.id,
      channelId: payload.channel?.id,
      messageTs: payload.message?.ts,
      actionType: payload.type,
      actionCount: payload.actions?.length
    });
    
    // Handle different types of actions
    if (payload.type === 'block_actions') {
      const action = payload.actions[0];
      
      // Check if this is a quiz answer
      if (action.action_id.startsWith('quiz_answer_')) {
        await handleQuizAnswer(payload, action);
      }
    }
    
    // Response needs to be 200 for Slack to acknowledge receipt
    return res.status(200).json({ message: 'Interaction received' });
  } catch (error) {
    console.error('❌ Error handling Slack interaction:', error);
    return res.status(500).json({ error: 'Failed to handle interaction' });
  }
}

async function handleQuizAnswer(payload: SlackActionPayload, action: SlackAction) {
  console.log('🧩 QUIZ ANSWER: Processing quiz answer');
  
  // Extract question index from the action ID
  const questionIndex = parseInt(action.action_id.replace('quiz_answer_', ''));
  // Get the selected answer
  const selectedAnswer = action.selected_option?.value;
  
  if (!selectedAnswer) {
    console.error('❌ No selected answer found in the action');
    return;
  }
  
  // Get message details
  const { channel, message } = payload;
  const messageTs = message.ts;
  const userId = payload.user.id;
  
  console.log('👤 USER INFO: User answering quiz:', { 
    userId, 
    username: payload.user.username,
    name: payload.user.name,
    messageTs,
    questionIndex,
    selectedAnswer 
  });
  
  // Fetch the quiz data to check if the answer is correct
  const quizData = await getQuizBySlackMessageId(messageTs);
  
  if (!quizData || !quizData.quiz || questionIndex >= quizData.quiz.length) {
    // Quiz data not found or index out of bounds
    console.error('❌ Quiz data not found or question index out of bounds:', {
      hasQuizData: !!quizData,
      quizDataId: quizData?.slackMessageId,
      questionIndex,
      quizLength: quizData?.quiz?.length
    });
    
    await sendEphemeralFeedback(
      channel.id,
      userId,
      "Sorry, I couldn't verify your answer. The quiz data may be missing."
    );
    return;
  }
  
  // Get the correct answer
  const question = quizData.quiz[questionIndex];
  const isCorrect = selectedAnswer === question.correct;
  
  console.log('📋 QUESTION INFO:', {
    questionText: question.question,
    selectedAnswer,
    correctAnswer: question.correct,
    isCorrect
  });
  
  // Create and save the response data
  const responseData = {
    userId,
    quizId: messageTs,
    questionIndex,
    question: question.question,
    answer: selectedAnswer,
    isCorrect,
    timestamp: new Date().toISOString(),
  };
  
  console.log('💾 SAVING RESPONSE:', responseData);
  
  try {
    // Check current responses.json file content
    try {
      const responsesPath = path.join(process.cwd(), 'data', 'responses.json');
      const responsesData = await fs.readFile(responsesPath, 'utf8');
      const existingResponses = JSON.parse(responsesData.toString() || '[]') as QuizResponse[];
      
      console.log('📊 EXISTING RESPONSES: Found', existingResponses.length, 'responses');
      
      // Count unique users
      const uniqueUsers = new Set(existingResponses.map((r: QuizResponse) => r.userId));
      console.log('👥 UNIQUE USERS:', Array.from(uniqueUsers));
      
      // Check for existing response from this user for this question
      const hasExistingResponse = existingResponses.some((r: QuizResponse) => 
        r.userId === userId && 
        r.quizId === messageTs && 
        r.questionIndex === questionIndex
      );
      
      console.log(`🔍 ${hasExistingResponse ? 'This user has already answered this question' : 'First answer from this user for this question'}`);
    } catch (_) {
      console.log('📝 No previous responses found');
    }
    
    const saved = await saveQuizResponse(responseData);
    console.log(`${saved ? '✅ Response successfully saved' : '❌ Response not saved (user already answered)'}`);
  } catch (error) {
    console.error('❌ Error saving response:', error);
  }
  
  // Send ephemeral feedback message
  const feedbackText = isCorrect
    ? `✅ Correct! "${selectedAnswer}" is the right answer.`
    : `❌ Incorrect!`;
  
  await sendEphemeralFeedback(channel.id, userId, feedbackText);
  
  // Also post a public message to show who answered
  /*try {
    await slack.chat.postMessage({
      channel: channel.id,
      thread_ts: messageTs,
      text: isCorrect 
        ? `✅ <@${userId}> answered correctly!`
        : `<@${userId}> answered "${selectedAnswer}", which is incorrect. The correct answer is "${question.correct}".`
    });
    console.log('📢 Posted public response in thread');
  } catch (error) {
    console.error('❌ Error posting public message:', error);
  }*/
}

async function sendEphemeralFeedback(channelId: string, userId: string, text: string) {
  try {
    await slack.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text
          }
        }
      ]
    });
    console.log('💬 Sent ephemeral feedback to user');
  } catch (error) {
    console.error('❌ Error sending ephemeral message:', error);
  }
} 