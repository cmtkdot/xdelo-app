import { ParsedContent } from './types.ts';

const SYSTEM_PROMPT = `Extract product information from captions following these rules:
1. Product Name: Text before '#' (required)
2. Product Code: Full code after '#'
3. Vendor UID: Letters at start of product code
4. Purchase Date: Convert MMDDYY or MDDYY to YYYY-MM-DD
5. Quantity: Look for numbers after 'x' or in units
6. Notes: Text in parentheses or remaining info

Example Input: "Blue Widget #ABC12345 x5 (new stock)"
Example Output: {
  "notes": "new stock",
  "quantity": 5,
  "vendor_uid": "ABC",
  "product_code": "ABC12345",
  "product_name": "Blue Widget",
  "purchase_date": "2023-12-34"
}`;

const OPENAI_API_URL = new URL('https://api.openai.com/v1/chat/completions');

export async function aiParse(caption: string): Promise<ParsedContent> {
  console.log('Attempting AI analysis for caption:', caption);
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
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
    const result = JSON.parse(data.choices[0].message.content);

    // Ensure correct field names and structure
    return {
      notes: result.notes || "",
      quantity: result.quantity ? Number(result.quantity) : null,
      vendor_uid: result.vendor_uid || "",
      product_code: result.product_code || "",
      product_name: result.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
      purchase_date: result.purchase_date || "",
      parsing_metadata: {
        method: 'ai',
        confidence: 0.8,
        fallbacks_used: []
      }
    };
  } catch (error) {
    console.error('Error occurred while making API request:', error);
    throw error;
  }
}