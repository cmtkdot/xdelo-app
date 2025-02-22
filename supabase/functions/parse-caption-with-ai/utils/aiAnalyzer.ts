import { ParsedContent } from "../../_shared/types.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract structured information following these rules:

1. Required Structure:
   - product_name: Text before '#', REQUIRED, must always be present
   - product_code: Value after '#' (format: #[vendor_uid][purchasedate])
   - vendor_uid: 1-4 letters after '#' before numeric date
   - purchase_date: Convert mmDDyy/mDDyy to YYYY-MM-DD format (add leading zero for 5-digit dates)
   - quantity: Integer after 'x'
   - notes: Any other values (in parentheses or remaining text)

2. Parsing Rules:
   - Dates: 
     * 6 digits: mmDDyy (120523 → 2023-12-05)
     * 5 digits: mDDyy (31524 → 2024-03-15)
   - Vendor IDs:
     * First 1-4 letters followed by optional valid date digits
     * If invalid date digits, append with hyphen (CHAD123 → CHAD-123)

3. Validation:
   - Only product_name is required
   - All other fields nullable if not found
   - Flag validation errors in 'notes' field

Example Input: "Blue Dream #CHAD120523 x2"
Expected Output: {
  "product_name": "Blue Dream",
  "product_code": "CHAD120523",
  "vendor_uid": "CHAD",
  "purchase_date": "2023-12-05",
  "quantity": 2
}`;

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
      quantity: typeof result.quantity === 'number' ? Math.max(0, Math.floor(result.quantity)) : undefined,
      notes: result.notes || '',
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
      notes: '',
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