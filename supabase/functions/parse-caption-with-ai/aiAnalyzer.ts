
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
    
    // Improved prompt with structured output requirements
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
          content: `You are a specialized product information extractor. Extract details from product captions and format them according to specific rules. 
          
          RULES:
          1. Extract product_name - text before "#" symbol, line break, or "x"
          2. Extract product_code - text following "#" symbol (without the "#")
          3. Extract vendor_uid - first 1-4 letters of product_code (uppercase)
          4. Extract purchase_date - parse date from product_code:
             - For 6 digits (mmDDyy): convert to YYYY-MM-DD
             - For 5 digits (mDDyy): convert to YYYY-MM-DD with leading zero
          5. Extract quantity - number following "x" (e.g., "x2" means quantity: 2)
          6. Extract notes - text in parentheses or remaining unclassified text
          
          RESPOND ONLY WITH JSON in this format:
          {
            "product_name": "string",
            "product_code": "string", 
            "vendor_uid": "string",
            "purchase_date": "YYYY-MM-DD",
            "quantity": number or null,
            "notes": "string",
            "confidence": number between 0 and 1
          }`
        }, {
          role: "user",
          content: `Parse this product caption: ${caption}`
        }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response format from OpenAI');
    }
    
    const aiAnalysis = result.choices[0].message.content;
    console.log(`AI analysis raw result: ${aiAnalysis}`);
    
    // Parse the JSON response
    let parsedAIResult;
    try {
      parsedAIResult = JSON.parse(aiAnalysis);
      console.log('Parsed AI result:', parsedAIResult);
    } catch (parseError) {
      console.error('Failed to parse AI result as JSON:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }
    
    // Validate the result has required fields
    if (!parsedAIResult.product_name) {
      console.warn('AI analysis missing product_name, using manual result');
      parsedAIResult.product_name = manualAnalysis.product_name;
    }

    // Get confidence score
    const confidence = parsedAIResult.confidence || 0.8;
    delete parsedAIResult.confidence; // Remove from final result

    // Return the enhanced result
    return {
      success: true,
      result: {
        ...manualAnalysis,
        ...parsedAIResult,
        parsing_metadata: {
          method: 'ai',
          confidence,
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
