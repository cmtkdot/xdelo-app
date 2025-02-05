import { ParsedContent } from "../types.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract structured information following these rules:

1. Product Name (REQUIRED):
   - Keep all emojis in their original form
   - Include emojis if they are part of the product name
   - Clean up any trailing spaces or newlines

2. Notes (OPTIONAL):
   - Preserve all emojis in flavor descriptions
   - Keep original emoji characters intact

Example Input: "Blue Dream 🌿 #ABC123 (indoor grow 🏠)"
Expected Output: {
  "product_name": "Blue Dream 🌿",
  "product_code": "ABC123",
  "notes": "indoor grow 🏠"
}`;

const AI_TIMEOUT_MS = 15000; // 15 seconds timeout

export async function analyzeCaption(caption: string): Promise<ParsedContent> {
  try {
    console.log("Starting caption analysis:", caption);

    // First try manual parsing
    const manualResult = await manualParse(caption);
    if (manualResult?.product_name) {
      console.log('Successfully parsed caption manually:', manualResult);
      return manualResult;
    }

    // Fallback to AI analysis
    console.log('Manual parsing incomplete, attempting AI analysis');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Add timeout to AI request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: caption }
          ],
          temperature: 0.3,
          max_tokens: 500
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('No response from AI');
      }

      try {
        const parsedResponse = JSON.parse(aiResponse);
        return {
          ...parsedResponse,
          parsing_metadata: {
            method: 'ai',
            confidence: 0.95,
            timestamp: new Date().toISOString()
          }
        };
      } catch (parseError) {
        console.error('Failed to parse AI response, falling back to manual');
        return {
          ...manualResult,
          parsing_metadata: {
            method: 'manual_fallback',
            confidence: 0.8,
            error: 'AI parse error'
          }
        };
      }
    } catch (aiError) {
      console.error('AI analysis failed, falling back to manual:', aiError);
      return {
        ...manualResult,
        parsing_metadata: {
          method: 'manual_fallback',
          confidence: 0.8,
          error: aiError.message
        }
      };
    }
  } catch (error) {
    console.error('Error in analyzeCaption:', error);
    // Final fallback to manual parsing
    const fallbackResult = await manualParse(caption);
    return {
      ...fallbackResult,
      parsing_metadata: {
        method: 'manual_fallback',
        confidence: 0.8,
        error: error.message
      }
    };
  }
}