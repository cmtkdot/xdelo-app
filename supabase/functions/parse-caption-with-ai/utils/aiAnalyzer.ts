import { ParsedContent } from "../types.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `Extract product information from captions following these rules:
1. Product Name: Text before '#' (required)
2. Product Code: Full code after '#'
3. Vendor UID: Letters at start of product code
4. Purchase Date: Convert MMDDYY or MDDYY to YYYY-MM-DD
5. Quantity: Look for numbers after 'x' or in units
6. Notes: Text in parentheses or remaining info

Example Input: "Blue Widget #ABC12345 x5 (new stock)"
Example Output: {
  "product_name": "Blue Widget",
  "product_code": "ABC12345",
  "vendor_uid": "ABC",
  "purchase_date": "2023-12-34",
  "quantity": 5,
  "notes": "new stock"
}`;

export async function analyzeCaption(caption: string): Promise<ParsedContent> {
  try {
    // First try manual parsing
    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    // If manual parsing is successful and has high confidence, use it
    if (
      manualResult && 
      manualResult.product_name && 
      manualResult.quantity &&
      manualResult.parsing_metadata?.confidence > 0.8
    ) {
      console.log('Using manual parsing result with high confidence');
      return {
        ...manualResult,
        parsing_metadata: {
          ...manualResult.parsing_metadata,
          method: 'manual',
          reanalysis_attempted: false
        }
      };
    }

    // Fallback to AI analysis
    console.log('Manual parsing incomplete or low confidence, attempting AI analysis');
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
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Validate quantity
    if (typeof result.quantity === 'number') {
      result.quantity = Math.floor(result.quantity);
      if (result.quantity <= 0) {
        delete result.quantity;
      }
    }

    console.log('AI analysis result:', result);
    return {
      ...result,
      parsing_metadata: {
        method: 'ai',
        confidence: 0.9,
        reanalysis_attempted: false,
        ai_model: 'gpt-4o-mini'
      }
    };
  } catch (error) {
    console.error('Error analyzing caption:', error);
    // Return basic info even if analysis fails
    return {
      product_name: caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
      parsing_metadata: {
        method: 'fallback',
        confidence: 0.1,
        error: error.message,
        reanalysis_attempted: false
      }
    };
  }
}