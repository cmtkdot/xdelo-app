import { ParsedContent } from './types.ts';

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract the following from the caption:
1. Product Name: Text before '#'
2. Product Code: Full code after '#'
3. Vendor UID: Letters at start of product code
4. Purchase Date: Convert mmDDyy or mDDyy to YYYY-MM-DD
5. Quantity: Look for numbers after 'x' or in units
6. Notes: Text in parentheses or remaining info

Return a JSON object with these fields and include confidence levels.`;

export async function aiParse(caption: string): Promise<ParsedContent> {
  console.log('Attempting AI analysis for caption:', caption);
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
  const aiResult = JSON.parse(data.choices[0].message.content);

  return {
    ...aiResult,
    parsing_metadata: {
      method: 'ai',
      confidence: 0.8,
      fallbacks_used: []
    }
  };
}