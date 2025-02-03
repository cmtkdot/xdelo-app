import { AnalyzedContent } from "../types.ts";
import { parseDate } from "./dateParser.ts";
import { manualParse } from "./manualParser.ts";

const SYSTEM_PROMPT = `You are a product information extractor. Your task is to analyze product-related captions and extract structured information. Focus on identifying:
- Product name
- Product code (usually starts with # or appears as a code)
- Vendor UID (if present)
- Purchase date (in any format)
- Quantity (numerical value)
- Additional notes

Format dates as YYYY-MM-DD. If information is not present, omit the field.`;

export async function analyzeCaption(caption: string): Promise<AnalyzedContent> {
  try {
    // First try manual parsing for simple cases
    const manualResult = manualParse(caption);
    if (Object.keys(manualResult).length > 0) {
      console.log("Successfully parsed using manual parser:", manualResult);
      return manualResult;
    }

    // If manual parsing doesn't yield results, use OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log("Analyzing caption with OpenAI:", caption);

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

    // Parse the AI response into structured data
    let parsedContent: AnalyzedContent = {};
    try {
      // Try to parse as JSON first
      parsedContent = JSON.parse(aiResponse);
    } catch (e) {
      // If not JSON, try to extract information from the text
      const lines = aiResponse.split('\n');
      for (const line of lines) {
        if (line.includes('Product name:')) parsedContent.product_name = line.split(':')[1]?.trim();
        if (line.includes('Product code:')) parsedContent.product_code = line.split(':')[1]?.trim();
        if (line.includes('Vendor UID:')) parsedContent.vendor_uid = line.split(':')[1]?.trim();
        if (line.includes('Purchase date:')) {
          const dateStr = line.split(':')[1]?.trim();
          parsedContent.purchase_date = parseDate(dateStr);
        }
        if (line.includes('Quantity:')) {
          const qty = parseInt(line.split(':')[1]?.trim());
          if (!isNaN(qty)) parsedContent.quantity = qty;
        }
        if (line.includes('Notes:')) parsedContent.notes = line.split(':')[1]?.trim();
      }
    }

    console.log("Final parsed content:", parsedContent);
    return parsedContent;
  } catch (error) {
    console.error('Error analyzing caption:', error);
    throw error;
  }
}