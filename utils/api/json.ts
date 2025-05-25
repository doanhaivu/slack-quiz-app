/**
 * Utility functions for safely parsing JSON from API responses
 */

/**
 * Safely parse JSON from a string, handling errors and malformed JSON
 * 
 * @param jsonString The JSON string to parse
 * @returns The parsed JSON object or null if parsing fails
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    // Clean the JSON string first
    const cleaned = cleanJsonString(jsonString);
    
    // Try direct parsing
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.log('JSON parsing failed:', error instanceof Error ? error.message : String(error));
    
    // Try to extract JSON object or array from the string
    try {
      // Look for JSON object pattern
      const objectMatch = jsonString.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        const cleaned = cleanJsonString(objectMatch[0]);
        return JSON.parse(cleaned) as T;
      }
      
      // Look for JSON array pattern
      const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const cleaned = cleanJsonString(arrayMatch[0]);
        return JSON.parse(cleaned) as T;
      }
    } catch (extractError) {
      console.error('JSON extraction also failed:', extractError instanceof Error ? extractError.message : String(extractError));
    }
    
    console.error('Could not parse JSON from string:', jsonString.substring(0, 200) + '...');
    return null;
  }
}

/**
 * Clean JSON string by removing common issues
 */
function cleanJsonString(jsonStr: string): string {
  return jsonStr
    .trim()
    // Remove any text before the first { or [
    .replace(/^[^{\[]*/, '')
    // Remove any text after the last } or ]
    .replace(/[^}\]]*$/, '')
    // Remove control characters except newlines and tabs in strings
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Fix smart quotes
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
} 