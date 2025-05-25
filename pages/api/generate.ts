// pages/api/generate.ts
import { OpenAI } from 'openai';
import { WebClient } from '@slack/web-api';
import fs from 'fs/promises';
import { NextApiRequest, NextApiResponse } from 'next';
import { SLACK_CHANNEL_ID } from '../../constants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

interface FormData {
  title: string;
  summary: string;
  url?: string;
  pictureUrl?: string;
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

interface SlackMessageData {
  title: string;
  summary: string;
  url: string | null;
  pictureUrl: string | null;
  category: string;
  quiz: QuizQuestion[];
  vocabulary: VocabularyItem[];
  slackMessageId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, summary, url, pictureUrl, category } = req.body as FormData;

  try {
    // Generate quiz
    const quizPrompt = `
      Generate a 5-question multiple-choice quiz based on this newsletter content:
      Title: ${title}
      Summary: ${summary}
      Each question should have 4 answer options and include the correct answer.
      
      IMPORTANT: The "correct" field should contain the exact text of the correct answer option, not "Option X".
      
      Format as JSON:
      [
        {
          "question": "Question text",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correct": "Option 2"  <-- This should be the exact text, e.g. "Option 2", not just "2"
        },
        ...
      ]
    `;
    const quizResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: quizPrompt }],
      temperature: 0.7,
    });
    
    let quiz = JSON.parse(quizResponse.choices[0].message.content as string) as QuizQuestion[];
    
    // Post-process quiz to ensure correct answers are the actual text values
    quiz = quiz.map(q => {
      // If the correct answer is in "Option X" format, convert it to the actual option text
      if (q.correct && q.correct.startsWith("Option ")) {
        const optionIndex = parseInt(q.correct.split(" ")[1]) - 1;
        if (!isNaN(optionIndex) && optionIndex >= 0 && optionIndex < q.options.length) {
          q.correct = q.options[optionIndex];
        }
      }
      return q;
    });

    // Generate vocabulary
    const vocabPrompt = `
      Extract 5 key terms or phrases from this newsletter content and provide a brief definition for each:
      Title: ${title}
      Summary: ${summary}
      Format as JSON:
      [
        {
          "term": "Term",
          "definition": "Definition"
        },
        ...
      ]
    `;
    const vocabResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: vocabPrompt }],
      temperature: 0.7,
    });
    const vocabulary = JSON.parse(vocabResponse.choices[0].message.content as string) as VocabularyItem[];

    // Format Slack message
    const slackMessage: SlackMessageData = {
      title,
      summary,
      url: url || null,
      pictureUrl: pictureUrl || null,
      category,
      quiz,
      vocabulary,
    };

    // Post to Slack
    const slackResponse = await postToSlack(slackMessage);
    console.log('Slack message posted with timestamp:', slackResponse.ts);

    // Create quiz entry with detailed metadata
    const quizEntry = {
      ...slackMessage,
      slackMessageId: slackResponse.ts,
      timestamp: new Date().toISOString(),
      sourceMessage: undefined
    };

    // Save quiz as individual file
    try {
      const timestamp = new Date().getTime();
      const messageId = slackResponse.ts || `unknown_${timestamp}`;
      const filename = `./data/quizzes/quiz_${timestamp}_${messageId.replace('.', '_')}.json`;
      
      await fs.writeFile(
        filename,
        JSON.stringify(quizEntry, null, 2)
      );
      console.log('Quiz saved as individual file:', filename);
    } catch (writeError) {
      console.error('Error writing individual quiz file:', writeError);
    }

    res.status(200).json({ ...slackMessage, slackMessageId: slackResponse.ts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
}

async function postToSlack({ 
  title, 
  summary, 
  url, 
  pictureUrl, 
  category, 
  quiz, 
  vocabulary 
}: SlackMessageData) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `📣 *${title}* (${category})\n${summary}${url ? `\n<${url}|Read more>` : ''}`,
      },
      ...(pictureUrl
        ? {
            accessory: {
              type: 'image',
              image_url: pictureUrl,
              alt_text: title,
            },
          }
        : {}),
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Key Vocabulary*' },
    },
    ...vocabulary.map((v) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: `• *${v.term}*: ${v.definition}` },
    })),
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Quiz: Test Your Knowledge!*' },
    },
    // Display all questions
    ...quiz.map((q, index) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Q${index + 1}: ${q.question}*` },
      accessory: {
        type: 'static_select',
        placeholder: { type: 'plain_text', text: 'Choose an answer' },
        options: q.options.map((opt) => ({
          text: { type: 'plain_text', text: opt },
          value: opt,
        })),
        action_id: `quiz_answer_${index}`,
      },
    })),
  ];

  const response = await slack.chat.postMessage({
    channel: SLACK_CHANNEL_ID,
    blocks,
    text: `New quiz: ${title}`, // Fallback text
  });

  return response;
}
