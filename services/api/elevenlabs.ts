import axios from 'axios';
import { TextToSpeechOptions } from '../../types';

// Get ElevenLabs API key from environment variables
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

/**
 * Check if ElevenLabs API is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!elevenLabsApiKey;
}

/**
 * Convert text to speech using ElevenLabs API
 * 
 * @param options Text-to-speech options
 * @returns Audio buffer or null if conversion fails
 */
export async function convertTextToSpeech(options: TextToSpeechOptions): Promise<Buffer | null> {
  if (!elevenLabsApiKey) {
    console.error('ElevenLabs API key is not configured');
    return null;
  }

  try {
    const voiceId = options.voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Updated to a known voice ID (Adam)
    const modelId = options.modelId || 'eleven_monolingual_v1'; // Default model
    
    console.log(`Converting text to speech with ElevenLabs. Text length: ${options.text.length}`);
    
    // No text length limit - use the full text
    const textToConvert = options.text;
    
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey
      },
      data: JSON.stringify({
        text: textToConvert,
        model_id: modelId,
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75
        }
      }),
      responseType: 'arraybuffer'
    });
    
    console.log('Text-to-speech conversion successful');
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error converting text to speech:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('ElevenLabs API error details:', error.response.status, error.response.statusText);
      console.error('Error response data:', error.response.data ? JSON.stringify(error.response.data) : 'No data');
    }
    return null;
  }
} 