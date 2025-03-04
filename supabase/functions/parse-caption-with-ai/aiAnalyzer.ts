
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ParsedContent } from './types.ts';

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// AI analysis function with improved error handling and fallbacks
export const analyzeWithAI = async (caption: string, manualParsing: ParsedContent) => {
  try {
    console.log('Sending caption to AI analyzer');
    
    // Call the AI analysis Edge Function with timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-with-ai', {
        body: { caption, messageId: 'temp' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('Error calling AI analysis function:', error);
        return { 
          success: false, 
          error: error.message, 
          result: null,
          errorType: 'invoke_error' 
        };
      }
      
      if (!data || !data.data) {
        console.error('AI analysis returned no data');
        return { 
          success: false, 
          error: 'No data returned from AI', 
          result: null,
          errorType: 'empty_response' 
        };
      }
      
      // We received valid data from the AI function
      console.log('AI analysis returned structured data');
      
      // Extract the AI results - should be structured JSON already
      const aiResults = data.data;
      
      // Prepare final result with metadata
      const enhancedResult: ParsedContent = {
        product_name: aiResults.product_name || manualParsing.product_name,
        product_code: aiResults.product_code || manualParsing.product_code,
        vendor_uid: aiResults.vendor_uid || manualParsing.vendor_uid,
        purchase_date: aiResults.purchase_date || manualParsing.purchase_date,
        quantity: aiResults.quantity ?? manualParsing.quantity,
        notes: aiResults.notes || manualParsing.notes,
        caption: manualParsing.caption,
        parsing_metadata: {
          method: 'ai',
          timestamp: new Date().toISOString(),
          confidence: 0.9, // Higher confidence for structured output
          ai_response: JSON.stringify(aiResults)
        }
      };
      
      console.log('Enhanced AI result:', enhancedResult);
      return { success: true, result: enhancedResult };
    } catch (abortError) {
      clearTimeout(timeoutId);
      
      if (abortError.name === 'AbortError') {
        console.error('AI analysis request timed out');
        return { 
          success: false, 
          error: 'AI analysis timed out', 
          result: null,
          errorType: 'timeout' 
        };
      }
      
      throw abortError; // Re-throw other errors
    }
  } catch (error) {
    console.error('Error in AI analysis:', error);
    return { 
      success: false, 
      error: error.message, 
      result: null,
      errorType: error.name 
    };
  }
}

// Helper to merge AI and manual parsing results
export const mergeParsingResults = (aiResult: ParsedContent, manualResult: ParsedContent): ParsedContent => {
  return {
    product_name: aiResult.product_name || manualResult.product_name,
    product_code: aiResult.product_code || manualResult.product_code,
    vendor_uid: aiResult.vendor_uid || manualResult.vendor_uid,
    purchase_date: aiResult.purchase_date || manualResult.purchase_date,
    quantity: aiResult.quantity ?? manualResult.quantity,
    notes: aiResult.notes || manualResult.notes,
    caption: manualResult.caption,
    parsing_metadata: {
      method: 'hybrid',
      timestamp: new Date().toISOString(),
      original_manual_parse: manualResult,
      ai_response: typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)
    }
  };
}
