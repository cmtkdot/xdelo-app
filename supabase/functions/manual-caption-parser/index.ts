
import { xdelo_parseCaption } from "../_shared/captionParser.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

interface AnalysisRequest {
  messageId: string;
  caption?: string;
  media_group_id?: string;
  queue_id?: string;
  isEdit?: boolean;
  correlationId?: string;
  trigger_source?: string;
  force_reprocess?: boolean;
}

interface MediaGroupResult {
  success: boolean;
  synced_count: number;
  media_group_id: string;
  error?: string;
}

// Set up CORS headers for browser clients
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function handleCaptionParsing(request: AnalysisRequest) {
  // Input validation
  if (!request.messageId) {
    throw new Error("Missing required parameter: messageId");
  }

  try {
    // Fetch the message to get its caption
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
      throw new Error("No caption available for analysis");
    }

    console.log(`Analyzing caption for message ${request.messageId}: "${captionToAnalyze.substring(0, 100)}${captionToAnalyze.length > 100 ? '...' : ''}"`);
    
    // Determine if this is an edit operation
    const isEdit = request.isEdit || false;
    
    // Analyze the caption using our shared parser from _shared/captionParser.ts
    const parsedContent = xdelo_parseCaption(captionToAnalyze);
    
    // Add metadata about this processing operation
    const parsingMetadata = {
      method: 'manual' as const,
      timestamp: new Date().toISOString(),
      original_caption: captionToAnalyze,
      is_edit: isEdit,
    };
    
    if (request.trigger_source) {
      // Add additional metadata that might be useful but not part of the core type
      parsedContent.parsing_metadata = {
        ...parsingMetadata,
        trigger_source: request.trigger_source
      };
    } else {
      parsedContent.parsing_metadata = parsingMetadata;
    }

    // Save the analysis results to the database
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

    return {
      success: true,
      message_id: request.messageId,
      analyzed: true,
      caption_length: captionToAnalyze.length,
      has_media_group: !!message.media_group_id,
      media_group_id: message.media_group_id,
      media_group_synced: !!syncResult,
      synced_count: syncResult?.synced_count || 0
    };
  } catch (error) {
    console.error(`Error in handleCaptionParsing: ${error.message}`);
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
    // Use the dedicated edge function for media group synchronization
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/xdelo_sync_media_group`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          mediaGroupId,
          sourceMessageId,
          correlationId,
          forceSync: true,
          syncEditHistory: isEdit
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function sync failed: ${errorText || response.statusText}`);
    }
    
    const result = await response.json();
    return {
      success: result.success,
      synced_count: result.synced_count || 0,
      media_group_id: mediaGroupId
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
