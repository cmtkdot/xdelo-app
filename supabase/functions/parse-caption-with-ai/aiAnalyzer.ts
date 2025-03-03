import { ParsedContent } from './types.ts';

// Analyze caption using OpenAI
export const analyzeWithAI = async (
  caption: string,
  manualAnalysis: Partial<ParsedContent>
): Promise<{success: boolean, result?: Partial<ParsedContent>, error?: string}> => {
  try {
    console.log(`Using AI analysis for caption: ${caption.substring(0, 50)}...`);
    const API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!API_KEY) {
      throw new Error('OpenAI API key not found');
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "You are a product information extractor. Extract product details from the given caption."
        }, {
          role: "user",
          content: `Extract product name, product code, vendor ID, purchase date, and quantity from this caption: ${caption}`
        }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const aiAnalysis = result.choices[0].message.content;
    console.log(`AI analysis result: ${aiAnalysis}`);

    // Return the enhanced result
    return {
      success: true,
      result: {
        ...manualAnalysis,
        parsing_metadata: {
          method: 'ai',
          timestamp: new Date().toISOString()
        }
      }
    };
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
