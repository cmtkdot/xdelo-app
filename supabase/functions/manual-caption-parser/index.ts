
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Manual parsing logic
import { parseCaption } from "./captionParser.ts";
import { ParsedContent, MediaGroupResult } from "./types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if this is a database webhook or direct API call
    let messageId, caption, mediaGroupId, correlationId, triggerSource, forceReprocess;
    
    if (req.method === 'POST') {
      try {
        // This is a direct API call
        const payload = await req.json();
        
        // Extract required parameters
        messageId = payload.messageId;
        caption = payload.caption;
        mediaGroupId = payload.media_group_id || payload.mediaGroupId;
        correlationId = payload.correlationId || crypto.randomUUID();
        triggerSource = payload.trigger_source || 'api';
        forceReprocess = payload.force_reprocess || false;
        
        // Validate required parameters
        if (!messageId || !caption) {
          throw new Error("Missing required parameters: messageId and caption");
        }
      } catch (parseError) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Invalid request payload: ${parseError.message}` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } else {
      // This is likely a database webhook trigger
      try {
        const payload = await req.json();
        const record = payload.record;
        
        if (!record) {
          throw new Error("No record found in webhook payload");
        }
        
        messageId = record.id;
        caption = record.caption;
        mediaGroupId = record.media_group_id;
        correlationId = record.correlation_id || crypto.randomUUID();
        triggerSource = 'database_trigger';
      } catch (parseError) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Invalid webhook payload: ${parseError.message}` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }
    
    // Log the processing start
    console.log(`Processing message ${messageId} with caption: ${caption?.substring(0, 50)}...`);
    
    // Log the processing request
    await supabase.from('unified_audit_logs').insert({
      event_type: 'caption_processing_request',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        trigger_source: triggerSource,
        has_caption: !!caption,
        force_reprocess: forceReprocess,
        media_group_id: mediaGroupId
      },
      event_timestamp: new Date().toISOString()
    });
    
    if (!caption) {
      console.log(`Message ${messageId} has no caption to process`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "No caption to process",
          messageId
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    // Parse the caption
    const parsedContent = parseCaption(caption);
    
    // Update the message with the parsed content
    // Always use 'completed' for the processing state
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: parsedContent,
        processing_state: "completed",
        processing_completed_at: new Date().toISOString(),
        is_original_caption: mediaGroupId ? true : undefined,
        group_caption_synced: mediaGroupId ? false : undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId);
    
    if (updateError) {
      throw new Error(`Failed to update message: ${updateError.message}`);
    }
    
    // Handle media group sync if needed
    let mediaGroupResult: MediaGroupResult = { success: false };
    
    if (mediaGroupId) {
      mediaGroupResult = await syncMediaGroup(
        mediaGroupId,
        messageId,
        parsedContent,
        correlationId
      );
    }
    
    // Log successful processing
    await supabase.from('unified_audit_logs').insert({
      event_type: 'caption_processing_completed',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        trigger_source: triggerSource,
        media_group_sync: mediaGroupResult.success,
        synced_count: mediaGroupResult.syncedCount || 0,
        processing_time: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        parsedContent,
        mediaGroupSync: mediaGroupResult
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error("Error processing caption:", error);
    
    // Try to log the error
    try {
      const { messageId, correlationId } = await req.json();
      
      if (messageId) {
        // Update the message processing state to error
        await supabase
          .from("messages")
          .update({
            processing_state: "error",
            error_message: error.message,
            last_error_at: new Date().toISOString(),
            retry_count: supabase.rpc('increment_retry_count', { p_message_id: messageId }),
            updated_at: new Date().toISOString()
          })
          .eq("id", messageId);
      }
      
      // Log the error
      await supabase.from('unified_audit_logs').insert({
        event_type: 'caption_processing_error',
        entity_id: messageId || 'unknown',
        correlation_id: correlationId || crypto.randomUUID(),
        error_message: error.message,
        metadata: {
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.error("Error logging failure:", logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper function to sync parsed content across a media group
async function syncMediaGroup(
  mediaGroupId: string,
  sourceMessageId: string,
  parsedContent: ParsedContent,
  correlationId: string
): Promise<MediaGroupResult> {
  try {
    if (!mediaGroupId) {
      return { success: false, reason: "No media group ID provided" };
    }

    // First, try to use the edge function for syncing
    try {
      const syncResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/xdelo_sync_media_group`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            mediaGroupId: mediaGroupId,
            sourceMessageId: sourceMessageId,
            correlationId: correlationId,
            forceSync: true
          })
        }
      );
      
      if (syncResponse.ok) {
        const result = await syncResponse.json();
        console.log(`Media group sync via edge function successful: ${JSON.stringify(result)}`);
        return { 
          success: true, 
          syncedCount: result.synced_count || 0,
          source_message_id: sourceMessageId,
          method: "edge-function" 
        };
      }
      
      console.warn(`Edge function sync failed with status ${syncResponse.status}, falling back to direct sync`);
      // Fall through to direct sync
    } catch (edgeFunctionError) {
      console.error(`Edge function sync error: ${edgeFunctionError.message}`);
      // Fall through to direct sync
    }

    // Add sync metadata to parsed content
    const contentWithSync = {
      ...parsedContent,
      sync_metadata: {
        ...parsedContent.sync_metadata,
        media_group_id: mediaGroupId,
        sync_source_message_id: sourceMessageId,
        sync_correlation_id: correlationId,
        sync_timestamp: new Date().toISOString()
      }
    };

    // Get all messages in the media group except the source message
    const { data: groupMessages, error: queryError } = await supabase
      .from("messages")
      .select("id")
      .eq("media_group_id", mediaGroupId)
      .neq("id", sourceMessageId);

    if (queryError) {
      return { 
        success: false, 
        error: `Failed to query media group: ${queryError.message}` 
      };
    }

    if (!groupMessages || groupMessages.length === 0) {
      return { 
        success: true, 
        syncedCount: 0, 
        reason: "No other messages in group to sync" 
      };
    }

    // Update all other messages in the group with the same analyzed content
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: contentWithSync,
        processing_state: "completed",
        processing_completed_at: new Date().toISOString(),
        group_caption_synced: true,
        is_original_caption: false,
        message_caption_id: sourceMessageId,
        updated_at: new Date().toISOString()
      })
      .eq("media_group_id", mediaGroupId)
      .neq("id", sourceMessageId);

    if (updateError) {
      return { 
        success: false, 
        error: `Failed to update media group: ${updateError.message}` 
      };
    }

    // Log the sync operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'media_group_sync_completed',
      entity_id: sourceMessageId,
      correlation_id: correlationId,
      metadata: {
        media_group_id: mediaGroupId,
        synced_count: groupMessages.length,
        method: "direct-db-update",
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });

    return { 
      success: true, 
      syncedCount: groupMessages.length,
      source_message_id: sourceMessageId,
      method: "direct-sync"
    };
  } catch (error) {
    console.error("Error syncing media group:", error);
    
    // Log the sync error
    try {
      await supabase.from('unified_audit_logs').insert({
        event_type: 'media_group_sync_error',
        entity_id: sourceMessageId,
        correlation_id: correlationId,
        error_message: error.message,
        metadata: {
          media_group_id: mediaGroupId,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.error("Failed to log sync error:", logError);
    }
    
    return { 
      success: false, 
      error: error.message,
      source_message_id: sourceMessageId
    };
  }
}
