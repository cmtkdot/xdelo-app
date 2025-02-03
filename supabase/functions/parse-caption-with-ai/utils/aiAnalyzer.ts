import { ParsedContent } from "../types.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a specialized product information extractor. Your task is to analyze captions and extract structured product information following these rules:

1. Product Name: Text before '#' (required)
2. Product Code: Full code after '#' including vendor and date
3. Vendor UID: 1-4 letters after '#' before any numbers
4. Purchase Date: Convert date format:
   - 6 digits (mmDDyy) -> YYYY-MM-DD
   - 5 digits (mDDyy) -> YYYY-MM-DD (add leading zero)
5. Quantity: Look for numbers after 'x' that:
   - Must be a positive integer
   - Should not be part of a measurement (e.g., '2x4' lumber)
   - Should be standalone (e.g., 'x5' or 'x 5')
6. Notes: Any additional info in parentheses or unstructured text`;

export async function analyzeCaption(caption: string): Promise<ParsedContent> {
  try {
    console.log('Starting caption analysis for:', caption);
    
    // First try manual parsing
    const manualResult = manualParse(caption);
    if (manualResult && manualResult.product_name && manualResult.quantity) {
      console.log('Successfully parsed caption manually:', manualResult);
      return manualResult;
    }

    // Fallback to AI analysis
    console.log('Manual parsing incomplete, attempting AI analysis');
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
        model: 'gpt-4',
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
    console.log('OpenAI API response:', data);
    
    const result = JSON.parse(data.choices[0].message.content);

    // Validate quantity
    if (typeof result.quantity === 'number') {
      result.quantity = Math.floor(result.quantity);
      if (result.quantity <= 0) {
        delete result.quantity;
      }
    }

    console.log('Final analyzed result:', result);
    return {
      product_name: result.product_name || caption.split('#')[0]?.trim() || 'Untitled Product',
      product_code: result.product_code,
      vendor_uid: result.vendor_uid,
      purchase_date: result.purchase_date,
      quantity: result.quantity,
      notes: result.notes,
      parsing_metadata: {
        method: 'ai',
        confidence: 0.8
      }
    };
  } catch (error) {
    console.error('Error analyzing caption:', error);
    // Return basic info even if analysis fails
    return {
      product_name: caption.split('#')[0]?.trim() || 'Untitled Product',
      parsing_metadata: {
        method: 'ai',
        confidence: 0.1,
        fallbacks_used: ['error_fallback']
      }
    };
  }
}