
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

// Create Supabase client
const supabase = createSupabaseClient();

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { messageId, caption, forceReprocess = false } = await req.json();
    
    if (!messageId) {
      throw new Error("messageId is required");
    }
    
    // Get the message if caption is not provided
    let messageCaption = caption;
    if (!messageCaption) {
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('caption')
        .eq('id', messageId)
        .single();
        
      if (fetchError) {
        throw new Error(`Error fetching message: ${fetchError.message}`);
      }
      
      if (!message) {
        throw new Error(`Message not found: ${messageId}`);
      }
      
      messageCaption = message.caption;
    }
    
    if (!messageCaption) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No caption to analyze",
          messageId
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
    
    // In a real implementation, you would:
    // 1. Parse the caption
    // 2. Extract product info, dates, etc.
    // 3. Update the message record with results
    
    // This is a mock implementation
    const mockAnalyzedContent = {
      product_name: "Sample Product",
      product_code: "XYZ123",
      vendor_uid: "ABC",
      purchase_date: new Date().toISOString().split('T')[0],
      quantity: 1,
      notes: "This is a sample analysis",
      parsing_metadata: {
        method: "analyze_caption",
        timestamp: new Date().toISOString(),
        original_caption: messageCaption
      }
    };
    
    // Update the message with analyzed content
    await supabase
      .from('messages')
      .update({
        analyzed_content: mockAnalyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Caption analyzed",
        messageId,
        analyzedContent: mockAnalyzedContent
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      }
    );
  }
});
