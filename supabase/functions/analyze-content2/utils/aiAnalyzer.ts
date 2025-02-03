import { parseManually } from "./manualParser.ts";
import { AnalyzedContent } from "../types.ts";

const SYSTEM_PROMPT = `You are a product information extractor. Extract structured information from product-related captions with these specific rules:

Required fields:
- product_name: Text before '#' (always required)
- product_code: Everything after '#' including vendor code and date
- vendor_uid: 1-4 letters after '#' before any numbers
- purchase_date: Convert date format:
  * 6 digits (mmDDyy) -> YYYY-MM-DD
  * 5 digits (mDDyy) -> YYYY-MM-DD (add leading zero)
- quantity: Number after 'x'
- notes: Any text in parentheses or unmatched text

Example inputs:
"Blue Dream #CHAD120523 x2"
"OG Kush #Z31524 x1"

Return ONLY a JSON object with these fields. Omit fields if information is not present.`;

export async function analyzeCaption(caption: string): Promise<AnalyzedContent> {
  console.log("Starting caption analysis:", caption);
  
  try {
    // Try manual parsing first
    const manualResult = parseManually(caption);
    if (manualResult.product_name) {
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
      const parsedResponse = JSON.parse(aiResponse);
      // Validate required fields
      if (!parsedResponse.product_name) {
        throw new Error('Product name is required but missing from AI response');
      }
      return parsedResponse;
    } catch (e) {
      console.log("Error parsing AI response, falling back to manual parsing");
      return parseManually(caption);
    }
  } catch (error) {
    console.error('Error analyzing caption:', error);
    // Always return at least a partial result with manual parsing
    return parseManually(caption);
  }
}