// pages/api/slack.ts
import { WebClient } from '@slack/web-api';
import fs from 'fs/promises';
import { createHmac } from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

interface SlackPayload {
  type: string;
  user: {
    id: string;
  };
  actions: {
    selected_option: {
      value: string;
    };
    action_id: string;
  }[];
  message: {
    ts: string;
  };
  channel: {
    id: string;
  };
}

interface ResponseData {
  userId: string;
  quizId: string;
  question: string;
  answer: string;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify Slack request
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;
  const body = JSON.stringify(req.body);
  const sigBase = `v0:${timestamp}:${body}`;
  const computedSig = `v0=${createHmac('sha256', process.env.SLACK_SIGNING_SECRET as string)
    .update(sigBase)
    .digest('hex')}`;

  if (computedSig !== signature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (req.body.type === 'url_verification') {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  if (req.body.type === 'event_callback') {
    return res.status(200).json({ status: 'ok' });
  }

  // Handle interactive response
  const payload: SlackPayload = JSON.parse(req.body.payload);
  if (payload.type === 'block_actions') {
    const { user, actions, message } = payload;
    const answer = actions[0].selected_option.value;
    const actionId = actions[0].action_id;

    // Save response to file (or Redis)
    const responseData: ResponseData = {
      userId: user.id,
      quizId: message.ts,
      question: actionId.replace('quiz_answer_', ''),
      answer,
      timestamp: new Date().toISOString(),
    };

    await fs.writeFile(
      './data/responses.json',
      JSON.stringify(
        [
          ...(await fs.readFile('./data/responses.json').then((d) => JSON.parse(d.toString())).catch(() => [])),
          responseData,
        ],
        null,
        2
      )
    );

    // Optional: Respond with confirmation
    await slack.chat.postEphemeral({
      channel: payload.channel.id,
      user: user.id,
      text: `Thanks for answering! You selected: ${answer}`,
    });
  }

  res.status(200).json({ status: 'ok' });
}
