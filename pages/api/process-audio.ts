import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs';
import { promisify } from 'util';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

const readFileAsync = promisify(fs.readFile);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({});
    const [fields, files] = await form.parse(req);
    const audioFile = files.audio?.[0];

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Read the audio file
    const audioBuffer = await readFileAsync(audioFile.filepath);
    
    // Create a File object from the buffer
    const file = new File([audioBuffer], audioFile.originalFilename || 'audio.wav', {
      type: audioFile.mimetype || 'audio/wav',
    });

    // Convert audio to text using OpenAI's Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    // Get the original news piece text from the request
    const originalText = fields.originalText?.[0];
    if (!originalText) {
      return res.status(400).json({ error: 'Original text not provided' });
    }

    // Use GPT to compare the transcription with the original text and assign a score
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert language teacher. Compare the student's pronunciation with the original text and provide a score from 0-100 based on accuracy, fluency, and pronunciation. Also provide specific feedback on what was good and what needs improvement."
        },
        {
          role: "user",
          content: `Original text: "${originalText}"\n\nStudent's pronunciation: "${transcription.text}"\n\nPlease provide a score and detailed feedback.`
        }
      ],
    });

    const feedback = completion.choices[0].message.content;

    return res.status(200).json({
      transcription: transcription.text,
      feedback,
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    return res.status(500).json({ error: 'Error processing audio' });
  }
} 