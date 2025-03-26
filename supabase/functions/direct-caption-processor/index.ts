
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { xdelo_parseCaption, ParsedContent } from "../_shared/captionParser.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling, logErrorToDatabase } from "../_shared/errorHandler.ts";
import { SecurityLevel } from "../_shared/jwt-verification.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface DirectProcessingRequest {
  messageId: string;
  caption?: string;
  mediaGroupId?: string;
  isEdit?: boolean;
  forceReprocess?: boolean;
  correlationId?: string;
  triggerSource?: string;
}

interface MediaGroupSyncResult {
  success: boolean;
  synced_count: number;
  media_group_id: string;
  error?: string;
}

// Main handler function
async function processCaption(req: Request, correlationId: string): Promise<Response> {
  const body = await req.json() as DirectProcessingRequest;
  const requestCorrelationId = body.correlationId || correlationId;
  
  console.log(`Direct caption processing for message ${body.messageId}, correlation_id: ${requestCorrelationId}`);
  
  if (!body.messageId) {
    throw new Error("Required parameter messageId is missing");
  }
  
  try {
    // Fetch the message
    const { data: message, error: fetchError } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("id", body.messageId)
      .single();
    
    if (fetchError) {
      throw new Error(`Error fetching message: ${fetchError.message}`);
    }
    
    if (!message) {
      throw new Error(`Message with ID ${body.messageId} not found`);
    }
    
    // Use provided caption or message caption
    const captionToProcess = body.caption || message.caption;
    
    if (!captionToProcess) {
      throw new Error("No caption available for processing");
    }
    
    console.log(`Processing caption: "${captionToProcess.substring(0, 50)}${captionToProcess.length > 50 ? '...' : ''}"`);
    
    // Parse the caption
    const parsedContent = xdelo_parseCaption(captionToProcess);
    
    // Add metadata
    parsedContent.parsing_metadata = {
      ...parsedContent.parsing_metadata,
      method: 'manual',
      timestamp: new Date().toISOString(),
      original_caption: captionToProcess,
      is_edit: body.isEdit || false,
      trigger_source: body.triggerSource || 'direct-caption-processor'
    };
    
    // Update the message with parsed content
    const { error: updateError } = await supabaseClient
      .from("messages")
      .update({
        analyzed_content: parsedContent,
        processing_state: "completed",
        processing_completed_at: new Date().toISOString(),
        is_original_caption: message.media_group_id ? true : null,
        group_caption_synced: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", body.messageId);
    
    if (updateError) {
      throw new Error(`Error updating message: ${updateError.message}`);
    }
    
    // Log the processing event
    await supabaseClient.from("unified_audit_logs").insert({
      event_type: 'caption_processed',
      entity_id: body.messageId,
      correlation_id: requestCorrelationId,
      metadata: {
        processing_time_ms: Date.now(),
        caption_length: captionToProcess.length,
        has_media_group: !!message.media_group_id,
        method: 'manual',
        is_edit: body.isEdit,
        force_reprocess: body.forceReprocess
      }
    });
    
    // Sync media group if needed
    let syncResult: MediaGroupSyncResult | null = null;
    if (message.media_group_id) {
      syncResult = await syncMediaGroupContent(
        message.media_group_id,
        body.messageId,
        requestCorrelationId,
        body.isEdit || body.forceReprocess || false
      );
      
      console.log(`Media group sync results: ${JSON.stringify(syncResult)}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message_id: body.messageId,
        analyzed: true,
        caption_length: captionToProcess.length,
        has_media_group: !!message.media_group_id,
        media_group_id: message.media_group_id,
        media_group_synced: !!syncResult,
        synced_count: syncResult?.synced_count || 0,
        correlation_id: requestCorrelationId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`Error in direct-caption-processor: ${error.message}`);
    
    // Log the error
    await logErrorToDatabase(supabaseClient, {
      messageId: body.messageId,
      errorMessage: error.message,
      correlationId: requestCorrelationId,
      functionName: 'direct-caption-processor'
    });
    
    // Update message with error state
    await supabaseClient
      .from("messages")
      .update({
        processing_state: "error",
        error_message: `Processing error: ${error.message}`,
        updated_at: new Date().toISOString()
      })
      .eq("id", body.messageId);
    
    throw error;
  }
}

async function syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string,
  includeEditHistory: boolean = false
): Promise<MediaGroupSyncResult> {
  try {
    // Use the dedicated edge function if available
    const syncEndpoint = `${Deno.env.get('SUPABASE_URL')}/functions/v1/xdelo_sync_media_group`;
    const response = await fetch(syncEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        mediaGroupId: mediaGroupId,
        sourceMessageId: sourceMessageId,
        correlationId: correlationId,
        forceSync: true,
        syncEditHistory: includeEditHistory
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Media group sync failed: ${errorText || response.statusText}`);
    }
    
    const result = await response.json();
    return {
      success: true,
      synced_count: result.synced_count || 0,
      media_group_id: mediaGroupId
    };
  } catch (error) {
    console.error(`Media group sync error: ${error.message}`);
    return {
      success: false,
      synced_count: 0,
      media_group_id: mediaGroupId,
      error: error.message
    };
  }
}

// Use the withErrorHandling wrapper with public security level
serve(withErrorHandling(
  'direct-caption-processor',
  processCaption,
  {
    securityLevel: SecurityLevel.PUBLIC,
    bypassForServiceRole: true
  }
));
