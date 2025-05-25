import { OpenAI } from 'openai';
import { QuizQuestion, VocabularyItem } from '../../types';

// Get OpenAI API key from environment variables
const openaiApiKey = process.env.OPENAI_API_KEY;

// Initialize OpenAI API client
const openai = new OpenAI({ apiKey: openaiApiKey });

/**
 * Check if OpenAI API is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!openaiApiKey;
}

/**
 * Extract items from text using OpenAI
 * 
 * @param extractionPrompt The prompt for extraction
 * @returns The content from OpenAI response
 */
export async function extractWithOpenAI(extractionPrompt: string): Promise<string | null> {
  try {
    // Set a timeout to prevent hanging
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => {
        reject(new Error('OpenAI API request timed out after 30 seconds'));
      }, 30000); // 30 second timeout
    });

    // Race the API call against the timeout
    const apiResponse = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4.1-nano', // Using faster model for extraction
        messages: [
          { 
            role: 'system', 
            content: 'You are a JSON extractor. Return ONLY valid JSON. No explanations, comments, or extra text. Extract real content only.'
          },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.2
      }),
      timeoutPromise
    ]);

    if (!apiResponse) {
      throw new Error('No response from OpenAI API');
    }

    // Check if the response is a stream or a completion
    let content: string | null = null;
    if ('choices' in apiResponse && Array.isArray(apiResponse.choices) && apiResponse.choices.length > 0) {
      content = apiResponse.choices[0].message?.content || null;
    } else {
      console.log('Unexpected response format from OpenAI');
    }

    return content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Generate combined quiz and vocabulary using OpenAI
 * 
 * @param contentText The content text to generate quiz and vocabulary from
 * @returns The generated quiz questions and vocabulary items
 */
export async function generateQuizAndVocabulary(
  contentText: string
): Promise<{ quiz: QuizQuestion[], vocabulary: VocabularyItem[] }> {
  // More concise and direct prompt
  const combinedPrompt = `Content: ${contentText}

Generate exactly 3 quiz questions and 3 vocabulary terms from this content.

Return ONLY valid JSON in this exact format:
{
  "quiz": [
    {
      "question": "Question text here",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "Option A"
    }
  ],
  "vocabulary": [
    {
      "term": "Term",
      "definition": "Brief definition"
    }
  ]
}

Rules:
- Keep options under 60 chars each
- Use simple language
- No special characters or newlines in strings
- Return ONLY the JSON object`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [
        { 
          role: 'system', 
          content: 'You are a JSON generator. Return ONLY valid JSON. No explanations, comments, or extra text. Escape quotes properly.'
        },
        { role: 'user', content: combinedPrompt }
      ],
      temperature: 0.3 // Lower temperature for more consistent output
    });
    
    // Extract content from the response
    let content: string | null = null;
    if ('choices' in response && Array.isArray(response.choices) && response.choices.length > 0) {
      content = response.choices[0].message?.content || null;
    }
    
    if (!content) {
      console.log('No combined content returned from OpenAI');
      return { quiz: [], vocabulary: [] };
    }

    // Clean the content before parsing
    const cleanedContent = cleanJsonString(content);
    
    // Try direct JSON parsing first
    try {
      const parsed = JSON.parse(cleanedContent) as { quiz: QuizQuestion[], vocabulary: VocabularyItem[] };
      
      // Validate the structure
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.quiz) && Array.isArray(parsed.vocabulary)) {
        console.log(`Successfully parsed: ${parsed.quiz.length} quiz questions and ${parsed.vocabulary.length} vocabulary items`);
        return parsed;
      }
    } catch (parseError) {
      console.log('Direct JSON parsing failed, attempting fallback extraction...', parseError instanceof Error ? parseError.message : String(parseError));
    }
    
    // Simple fallback: extract using basic regex
    const quiz: QuizQuestion[] = [];
    const vocabulary: VocabularyItem[] = [];
    
    // Extract quiz questions
    const quizPattern = /"question":\s*"([^"]+)"[^}]*"options":\s*\[([^\]]+)\][^}]*"correct":\s*"([^"]+)"/g;
    let quizMatch;
    while ((quizMatch = quizPattern.exec(content)) !== null) {
      const question = quizMatch[1];
      const optionsStr = quizMatch[2];
      const correct = quizMatch[3];
      
      // Parse options
      const options = optionsStr.match(/"([^"]+)"/g)?.map(opt => opt.slice(1, -1)) || [];
      
      if (question && options.length === 4 && correct) {
        quiz.push({ question, options, correct });
      }
    }
    
    // Extract vocabulary
    const vocabPattern = /"term":\s*"([^"]+)"[^}]*"definition":\s*"([^"]+)"/g;
    let vocabMatch;
    while ((vocabMatch = vocabPattern.exec(content)) !== null) {
      const term = vocabMatch[1];
      const definition = vocabMatch[2];
      
      if (term && definition) {
        vocabulary.push({ term, definition });
      }
    }
    
    console.log(`Fallback extraction result: ${quiz.length} quiz questions and ${vocabulary.length} vocabulary items`);
    return { quiz, vocabulary };
    
  } catch (error) {
    console.error('Error generating combined quiz and vocabulary:', error);
    return { quiz: [], vocabulary: [] };
  }
}

/**
 * Clean JSON string by removing common issues
 */
function cleanJsonString(jsonStr: string): string {
  return jsonStr
    .trim()
    // Remove any text before the first {
    .replace(/^[^{]*/, '')
    // Remove any text after the last }
    .replace(/[^}]*$/, '')
    // Remove control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Fix common quote issues
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"');
} 