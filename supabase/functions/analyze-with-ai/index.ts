
import { OpenAI } from "https://esm.sh/openai@4.20.1";
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse, 
  xdelo_createErrorResponse,
  xdelo_fetchWithRetry
} from '../_shared/standardizedHandler.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

// Define the main handler function
const handleAIAnalysis = async (req: Request, correlationId: string): Promise<Response> => {
  try {
    // Parse request body
    const { messageId, caption } = await req.json();

    if (!messageId || !caption) {
      return xdelo_createErrorResponse('Missing required parameters: messageId and caption', correlationId, 400);
    }

    // Get OpenAI API key from environment
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Missing OpenAI API key',
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      }));
      return xdelo_createErrorResponse('Configuration error: Missing API key', correlationId, 500);
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey,
      timeout: 15000, // 15 second timeout
    });

    console.log(JSON.stringify({
      level: 'info',
      message: 'Processing AI analysis',
      message_id: messageId,
      caption_length: caption.length,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }));

    // Define a retry mechanism
    const maxRetries = 2;
    let retries = 0;
    let response;
    let error;

    while (retries <= maxRetries) {
      try {
        response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: `You are a product information extraction assistant. Extract structured data from the given caption.
                
                Here are specific instructions for extracting product quantity:
                1. Look for explicit quantity markers like "x2", "x 2", "qty: 2", "quantity: 2"
                2. Check for quantity terms like "2 pcs", "2 pieces", "2 units"
                3. Look for numbers that appear after product codes (after # symbol)
                4. Check for standalone numbers that might indicate quantity
                5. Default to 1 if no quantity is specified but product clearly exists
                
                Please return only JSON in this exact format:
                {
                  "product_name": "Full product name",
                  "product_code": "Code found after # symbol",
                  "vendor_uid": "1-4 letter vendor code (usually first part of product_code)",
                  "purchase_date": "Date in YYYY-MM-DD format",
                  "quantity": number or null,
                  "notes": "Any additional details",
                  "extraction_confidence": {
                    "quantity": number between 0-1,
                    "overall": number between 0-1
                  }
                }` 
            },
            { 
              role: "user", 
              content: `Extract product details from this caption: "${caption}"` 
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        
        // If we get here, the API call was successful
        break;
      } catch (err) {
        error = err;
        console.error(JSON.stringify({
          level: 'warn',
          message: `AI analysis attempt ${retries + 1} failed`,
          error: err.message,
          message_id: messageId,
          retry: retries + 1,
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        }));
        
        // Exponential backoff
        if (retries < maxRetries) {
          const delay = Math.pow(2, retries) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        retries++;
      }
    }
    
    if (!response) {
      throw error || new Error('Failed to get response from AI after retries');
    }

    // Get the result content
    const result = response.choices[0].message.content;
    console.log(JSON.stringify({
      level: 'info',
      message: 'AI analysis completed successfully',
      message_id: messageId,
      result_length: result.length,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }));

    try {
      // Verify we have valid JSON output
      const parsedResult = JSON.parse(result);
      
      // Log success to unified_audit_logs
      const supabase = createSupabaseClient();
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'ai_analysis_completed',
          entity_id: messageId,
          metadata: {
            correlation_id: correlationId,
            confidence: parsedResult.extraction_confidence?.overall || 0,
            timestamp: new Date().toISOString()
          },
          correlation_id: correlationId
        });
      
      return xdelo_createSuccessResponse(parsedResult, correlationId);
    } catch (parseError) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Invalid JSON returned from AI',
        error: parseError.message,
        partial_result: result,
        message_id: messageId,
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      }));
      
      return xdelo_createErrorResponse('AI returned invalid format', correlationId, 422);
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Error during AI analysis',
      error: error.message,
      stack: error.stack,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }));
    
    return xdelo_createErrorResponse(error.message, correlationId, 500);
  }
};

// Use our standardized handler
export default xdelo_createStandardizedHandler(handleAIAnalysis);
