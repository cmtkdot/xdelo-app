
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { xdelo_parseCaption } from "../_shared/captionParser.ts";
import { createSupabaseClient, handleSupabaseError } from "../_shared/supabase.ts";

// Set up CORS headers for browser clients
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createSupabaseClient();

    // Parse the request body
    const requestData = await req.json();
    const { messageId, caption, correlationId = crypto.randomUUID().toString(), isEdit = false } = requestData;

    if (!messageId) {
      throw new Error("Missing required parameter: messageId");
    }

    console.log(`Processing caption for message ${messageId}`, {
      has_caption: !!caption,
      correlation_id: correlationId,
      is_edit: isEdit
    });

    // Fetch the message if no caption was provided
    let captionToProcess = caption;
    if (!captionToProcess) {
      const { data: message, error: fetchError } = await supabase
        .from("messages")
        .select("caption")
        .eq("id", messageId)
        .single();

      if (fetchError) {
        handleSupabaseError(fetchError, "fetch message");
      }

      if (!message || !message.caption) {
        throw new Error("No caption available for processing");
      }

      captionToProcess = message.caption;
    }

    // Use the shared xdelo_parseCaption function to analyze the caption
    const parsedContent = xdelo_parseCaption(captionToProcess);
    
    // Add metadata about this processing operation
    parsedContent.parsing_metadata = {
      method: 'direct',
      timestamp: new Date().toISOString(),
      original_caption: captionToProcess,
      is_edit: isEdit,
      correlation_id: correlationId
    };

    console.log("Parsed content result:", {
      product_name: parsedContent.product_name,
      vendor_uid: parsedContent.vendor_uid,
      purchase_date: parsedContent.purchase_date,
      parsing_success: parsedContent.parsing_success
    });

    // Update the message with the analyzed content
    const { data: updatedMessage, error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: parsedContent,
        processing_state: "completed",
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        correlation_id: correlationId
      })
      .eq("id", messageId)
      .select()
      .single();

    if (updateError) {
      handleSupabaseError(updateError, "update message");
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        analyzed: true,
        caption_length: captionToProcess.length,
        has_media_group: !!updatedMessage?.media_group_id,
        media_group_id: updatedMessage?.media_group_id
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in direct-caption-processor:", error.message);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
