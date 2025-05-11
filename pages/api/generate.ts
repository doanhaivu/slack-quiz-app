// pages/api/generate.ts
import { OpenAI } from 'openai';
import { WebClient } from '@slack/web-api';
import fs from 'fs/promises';
import { NextApiRequest, NextApiResponse } from 'next';

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
      Format as JSON:
      [
        {
          "question": "Question text",
          "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
          "correct": "Option 1"
        },
        ...
      ]
    `;
    const quizResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: quizPrompt }],
      temperature: 0.7,
    });
    const quiz = JSON.parse(quizResponse.choices[0].message.content as string) as QuizQuestion[];

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

    // Save to file (optional, instead of Redis)
    await fs.writeFile(
      './data/quizzes.json',
      JSON.stringify(
        [
          ...(await fs.readFile('./data/quizzes.json').then((d) => JSON.parse(d.toString())).catch(() => [])),
          { ...slackMessage, slackMessageId: slackResponse.ts },
        ],
        null,
        2
      )
    );

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
    // Post first question only for simplicity
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Q1: ${quiz[0].question}*` },
      accessory: {
        type: 'static_select',
        placeholder: { type: 'plain_text', text: 'Choose an answer' },
        options: quiz[0].options.map((opt) => ({
          text: { type: 'plain_text', text: opt },
          value: opt,
        })),
        action_id: `quiz_answer_${quiz[0].question.slice(0, 50)}`,
      },
    },
  ];

  const response = await slack.chat.postMessage({
    channel: '#news-quiz', // Change to your channel
    blocks,
    text: `New quiz: ${title}`, // Fallback text
  });

  return response;
}
