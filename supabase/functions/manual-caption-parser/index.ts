import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { xdelo_parseCaption } from "../_shared/captionParser.ts";
import { AnalysisRequest, MediaGroupResult, AnalysisResponse, FLOW_STAGES } from "./types.ts";

// Set up CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function handleCaptionParsing(request: AnalysisRequest): Promise<AnalysisResponse> {
  // Input validation
  if (!request.messageId) {
    throw new Error("Missing required parameter: messageId");
  }

  try {
    // Fetch the message
    const { data: message, error: fetchError } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("id", request.messageId)
      .single();

    if (fetchError) {
      throw new Error(`Error fetching message: ${fetchError.message}`);
    }

    if (!message) {
      throw new Error(`Message with ID ${request.messageId} not found`);
    }

    // Use the provided caption (for edits) or the one from the database
    const captionToAnalyze = request.caption || message.caption;
    
    if (!captionToAnalyze) {
      // If no caption, check if it's part of a media group 
      if (message.media_group_id) {
        return await handleMediaGroupSync(message.media_group_id, request.messageId, request.correlationId);
      }
      
      // Handle empty caption - set to initialized state
      await updateMessageState(request.messageId, FLOW_STAGES.INITIALIZED);
      
      return {
        success: true,
        message_id: request.messageId,
        analyzed: false,
        caption_length: 0,
        has_media_group: false,
        validation_result: {
          valid: false,
          missing_fields: ['product_name', 'product_code']
        }
      };
    }

    console.log(`Analyzing caption for message ${request.messageId}: "${captionToAnalyze.substring(0, 100)}${captionToAnalyze.length > 100 ? '...' : ''}"`);
    
    // Update to processing state
    await updateMessageState(request.messageId, FLOW_STAGES.PROCESSING);
    
    // Determine if this is an edit operation
    const isEdit = request.isEdit || false;
    
    // Analyze the caption using the parser
    const parsedContent = xdelo_parseCaption(captionToAnalyze);
    
    // Add metadata about this processing operation
    const parsingMetadata = {
      method: 'manual' as const,
      timestamp: new Date().toISOString(),
      original_caption: captionToAnalyze,
      is_edit: isEdit,
    };
    
    if (request.trigger_source) {
      // Add additional metadata
      parsedContent.parsing_metadata = {
        ...parsingMetadata,
        trigger_source: request.trigger_source
      };
    } else {
      parsedContent.parsing_metadata = parsingMetadata;
    }

    // Calculate the next flow state based on parsing result
    const nextState = parsedContent.parsing_metadata.partial_success 
      ? FLOW_STAGES.PARTIAL_SUCCESS 
      : FLOW_STAGES.COMPLETED;

    // Save the analysis results to the database
    const { error: updateError } = await supabaseClient
      .from("messages")
      .update({
        analyzed_content: parsedContent,
        processing_state: nextState,
        processing_completed_at: new Date().toISOString(),
        is_original_caption: message.media_group_id ? true : null,
        group_caption_synced: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", request.messageId);

    if (updateError) {
      throw new Error(`Error updating message with analysis: ${updateError.message}`);
    }

    let syncResult: MediaGroupResult | null = null;

    // If this is part of a media group, synchronize the content
    if (message.media_group_id) {
      syncResult = await syncMediaGroupContent(
        message.media_group_id,
        request.messageId,
        request.correlationId || crypto.randomUUID(),
        isEdit
      );
      
      console.log(`Media group sync completed: ${syncResult.synced_count} messages updated`);
    }

    // Prepare validation result
    const validationResult = {
      valid: !parsedContent.parsing_metadata.partial_success,
      missing_fields: parsedContent.parsing_metadata.missing_fields || [],
      invalid_formats: []
    };

    return {
      success: true,
      message_id: request.messageId,
      analyzed: true,
      caption_length: captionToAnalyze.length,
      has_media_group: !!message.media_group_id,
      media_group_id: message.media_group_id,
      media_group_synced: !!syncResult,
      synced_count: syncResult?.synced_count || 0,
      validation_result: validationResult
    };
  } catch (error) {
    console.error(`Error in handleCaptionParsing: ${error.message}`);
    
    // Update message to error state
    await updateMessageState(request.messageId, FLOW_STAGES.ERROR, error.message);
    
    throw error;
  }
}

async function handleMediaGroupSync(
  mediaGroupId: string,
  messageId: string,
  correlationId?: string
): Promise<AnalysisResponse> {
  try {
    // Find a message in the group that has a caption
    const { data: messages } = await supabaseClient
      .from("messages")
      .select("id, caption, analyzed_content")
      .eq("media_group_id", mediaGroupId)
      .neq("id", messageId)
      .order("is_original_caption", { ascending: false })
      .order("created_at", { ascending: true });
    
    // Find a suitable source message
    const sourceMessage = messages?.find(m => 
      m.analyzed_content && m.caption && m.caption.trim().length > 0
    );
    
    if (!sourceMessage) {
      // No source message found, keep in pending state
      await updateMessageState(messageId, FLOW_STAGES.PENDING);
      
      return {
        success: true,
        message_id: messageId,
        analyzed: false,
        caption_length: 0,
        has_media_group: true,
        media_group_id: mediaGroupId,
        media_group_synced: false,
        validation_result: {
          valid: false,
          missing_fields: ['product_name', 'product_code']
        }
      };
    }
    
    // Call the sync function using the source message
    const syncResult = await syncMediaGroupContent(
      mediaGroupId,
      sourceMessage.id,
      correlationId || crypto.randomUUID(),
    );
    
    return {
      success: true,
      message_id: messageId,
      analyzed: true,
      caption_length: 0,
      has_media_group: true,
      media_group_id: mediaGroupId,
      media_group_synced: syncResult.success,
      synced_count: syncResult.synced_count
    };
  } catch (error) {
    console.error(`Error in handleMediaGroupSync: ${error.message}`);
    throw error;
  }
}

async function syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string,
  isEdit: boolean = false
): Promise<MediaGroupResult> {
  try {
    // Try to get the analyzed content from the source message
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from("messages")
      .select("analyzed_content")
      .eq("id", sourceMessageId)
      .single();
    
    if (sourceError || !sourceMessage || !sourceMessage.analyzed_content) {
      return {
        success: false,
        media_group_id: mediaGroupId,
        synced_count: 0,
        error: sourceError?.message || "No analyzed content in source message"
      };
    }
    
    // Use the internal Supabase RPC function for group sync
    const { data, error } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_message_id: sourceMessageId,
        p_analyzed_content: sourceMessage.analyzed_content,
        p_force_sync: true,
        p_sync_edit_history: isEdit
      }
    );
    
    if (error) {
      console.error(`Error in syncMediaGroupContent RPC: ${error.message}`);
      return {
        success: false,
        media_group_id: mediaGroupId,
        synced_count: 0,
        error: error.message
      };
    }
    
    return {
      success: true,
      media_group_id: mediaGroupId,
      synced_count: data.updated_count || 0
    };
  } catch (error) {
    console.error(`Error in syncMediaGroupContent: ${error.message}`);
    return {
      success: false, 
      synced_count: 0,
      media_group_id: mediaGroupId,
      error: error.message
    };
  }
}

async function updateMessageState(
  messageId: string, 
  state: string, 
  errorMessage?: string
): Promise<boolean> {
  try {
    const updates: Record<string, any> = {
      processing_state: state,
      updated_at: new Date().toISOString()
    };
    
    if (state === FLOW_STAGES.PROCESSING) {
      updates.processing_started_at = new Date().toISOString();
    } else if (state === FLOW_STAGES.COMPLETED || state === FLOW_STAGES.PARTIAL_SUCCESS) {
      updates.processing_completed_at = new Date().toISOString();
    } else if (state === FLOW_STAGES.ERROR && errorMessage) {
      updates.error_message = errorMessage;
      updates.last_error_at = new Date().toISOString();
    }
    
    const { error } = await supabaseClient
      .from('messages')
      .update(updates)
      .eq('id', messageId);
      
    return !error;
  } catch (error) {
    console.error(`Error updating message state: ${error.message}`);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request = await req.json();
    
    console.log("Caption parser request received:", {
      messageId: request.messageId,
      isEdit: request.isEdit,
      hasCaption: !!request.caption,
      correlationId: request.correlationId,
      trigger_source: request.trigger_source
    });

    // Process the caption
    const result = await handleCaptionParsing(request);

    // Return success response
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`Error in manual-caption-parser: ${error.message}`);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
