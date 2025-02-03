import { ParsedContent } from "../types.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a specialized cannabis product information extractor. Extract structured information following these rules:

1. Product Name (REQUIRED):
   - Text before '#' or 'x' marker
   - Stop at first 'x' or '#' encountered
   - Remove any trailing spaces
   - Example: "Blue Dream x2" -> "Blue Dream"

2. Product Code:
   - Full code after '#' including vendor and date
   - Format: #[vendor_uid][date]
   - Example: "#CHAD120523" -> "CHAD120523"

3. Vendor UID:
   - 1-4 letters after '#' before any numbers
   - Example: "#CHAD120523" -> "CHAD"

4. Purchase Date:
   - Convert date formats:
   - 6 digits (mmDDyy) -> YYYY-MM-DD
   - 5 digits (mDDyy) -> YYYY-MM-DD (add leading zero)
   - Example: "120523" -> "2023-12-05"
   - Example: "31524" -> "2024-03-15"

5. Quantity:
   - Look for numbers after 'x' or 'qty:'
   - Must be positive integer
   - Common formats: "x2", "x 2", "qty: 2"
   - Ignore if part of measurement

6. Notes:
   - Text in parentheses
   - Any additional unstructured text
   - Example: "(indoor grown)" -> "indoor grown"

Example Input: "Blue Dream x2 #CHAD120523 (indoor)"
Expected Output: {
  "product_name": "Blue Dream",
  "product_code": "CHAD120523",
  "vendor_uid": "CHAD",
  "purchase_date": "2023-12-05",
  "quantity": 2,
  "notes": "indoor"
}`;

export async function analyzeCaption(caption: string): Promise<ParsedContent> {
  try {
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
      product_name: result.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
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
      product_name: caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
      parsing_metadata: {
        method: 'ai',
        confidence: 0.1,
        fallbacks_used: ['error_fallback']
      }
    };
  }
}