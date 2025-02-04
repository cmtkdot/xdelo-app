import { ParsedContent } from "../types.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract structured information following these rules:

1. Product Name (REQUIRED):
   - Text before any list markers or emoji sequences
   - Keep emojis if they are part of the product name
   - Remove any trailing spaces or newlines

2. Product Code (OPTIONAL):
   - Full code after '#' including vendor and date
   - Format: #[vendor_uid][date]

3. Vendor UID (OPTIONAL):
   - 1-4 letters after '#' before any numbers

4. Purchase Date (OPTIONAL):
   - Convert date formats:
   - 6 digits (mmDDyy) -> YYYY-MM-DD
   - 5 digits (mDDyy) -> YYYY-MM-DD (add leading zero)

5. Notes (OPTIONAL):
   - Preserve emojis in flavor descriptions
   - Format flavor lists with proper emoji handling
   - Keep original emoji characters intact

Example Input: "Blue Dream 🌿 x2 #CHAD120523 (indoor grow 🏠)"
Expected Output: {
  "product_name": "Blue Dream 🌿",
  "product_code": "CHAD120523",
  "vendor_uid": "CHAD",
  "purchase_date": "2023-12-05",
  "quantity": 2,
  "notes": "indoor grow 🏠"
}`;

export async function analyzeCaption(caption: string): Promise<ParsedContent> {
  try {
    console.log("Starting caption analysis:", caption);

    // First try manual parsing
    const manualResult = await manualParse(caption);
    if (manualResult && manualResult.product_name) {
      console.log('Successfully parsed caption manually:', manualResult);
      return {
        ...manualResult,
        parsing_metadata: {
          method: 'manual',
          confidence: 1.0,
          timestamp: new Date().toISOString()
        }
      };
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
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Please analyze this product caption, preserving all emojis:\n${caption}`
          }
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

    // Clean up and validate the result
    const cleanResult: ParsedContent = {
      product_name: result.product_name?.trim() || caption.split('\n')[0]?.trim() || 'Untitled Product',
      product_code: result.product_code || '',
      vendor_uid: result.vendor_uid || '',
      purchase_date: result.purchase_date || '',
      quantity: typeof result.quantity === 'number' ? Math.max(0, Math.floor(result.quantity)) : null,
      notes: result.notes || formatFlavorList(caption),
      parsing_metadata: {
        method: 'ai',
        confidence: 0.8,
        timestamp: new Date().toISOString()
      }
    };

    console.log('AI analysis result:', cleanResult);
    return cleanResult;

  } catch (error) {
    console.error('Error analyzing caption:', error);
    // Return basic info even if analysis fails
    return {
      product_name: caption.split('\n')[0]?.trim() || 'Untitled Product',
      notes: formatFlavorList(caption),
      parsing_metadata: {
        method: 'ai',
        confidence: 0.1,
        timestamp: new Date().toISOString(),
        fallbacks_used: ['error_fallback']
      }
    };
  }
}

function formatFlavorList(caption: string): string {
  try {
    const lines = caption.split('\n');
    const flavorSection = lines
      .slice(lines.findIndex(line => line.toLowerCase().includes('flavor')) + 1)
      .filter(line => line.trim() && !line.toLowerCase().includes('flavor'));

    if (flavorSection.length === 0) {
      return '';
    }

    return flavorSection.join('\n').trim();
  } catch (error) {
    console.error('Error formatting flavor list:', error);
    return '';
  }
}