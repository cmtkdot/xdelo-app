import { parseManually } from "./manualParser.ts";
import { AnalyzedContent } from "../types.ts";

const SYSTEM_PROMPT = `You are a product information extractor. Extract structured information from product-related captions. Focus on:
- Product name
- Product code (usually starts with # or appears as a code)
- Vendor UID (if present)
- Purchase date (in YYYY-MM-DD format)
- Quantity (numerical value)
- Additional notes

Return ONLY a JSON object with these fields. Omit fields if information is not present.`;

export async function analyzeCaption(caption: string): Promise<AnalyzedContent> {
  try {
    console.log("Starting caption analysis:", caption);
    
    // Try manual parsing first
    const manualResult = parseManually(caption);
    if (Object.keys(manualResult).length > 0) {
      console.log("Successfully parsed using manual parser:", manualResult);
      return manualResult;
    }

    // Fallback to OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: caption }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log("OpenAI response:", aiResponse);

    try {
      return JSON.parse(aiResponse);
    } catch (e) {
      console.log("Falling back to manual parsing of AI response");
      return parseManually(aiResponse);
    }
  } catch (error) {
    console.error('Error analyzing caption:', error);
    throw error;
  }
}