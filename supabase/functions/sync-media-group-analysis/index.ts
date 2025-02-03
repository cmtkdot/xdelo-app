import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ProcessingLog {
  event: string;
  message_id: string;
  media_group_id?: string;
  duration_ms?: number;
  state?: MessageProcessingState;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

type MessageProcessingState =
  | "initialized"
  | "caption_ready"
  | "analyzing"
  | "analysis_synced"
  | "completed"
  | "analysis_failed";

function logProcessingEvent(event: Omit<ProcessingLog, "timestamp">) {
  console.log(
    JSON.stringify({
      ...event,
      timestamp: new Date().toISOString(),
    })
  );
}

serve(async (req) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { message_id, media_group_id } = await req.json();

    if (!message_id || !media_group_id) {
      throw new Error("message_id and media_group_id are required");
    }

    logProcessingEvent({
      event: "SYNC_STARTED",
      message_id,
      media_group_id,
      metadata: { correlation_id: correlationId },
    });

    // Find all messages in the group
    const { data: groupMessages, error: groupError } = await supabase
      .from("messages")
      .select("*")
      .eq("media_group_id", media_group_id)
      .order("created_at", { ascending: true });

    if (groupError) {
      throw groupError;
    }

    if (!groupMessages?.length) {
      throw new Error("No messages found in group");
    }

    // First try to find a message with analyzed content
    let sourceMessage = groupMessages.find(m => m.analyzed_content);
    
    // If no analyzed content exists, look for a message with caption
    if (!sourceMessage) {
      sourceMessage = groupMessages.find(m => m.caption);
    }

    if (!sourceMessage) {
      logProcessingEvent({
        event: "NO_CAPTION_OR_CONTENT_FOUND",
        message_id,
        media_group_id,
        metadata: {
          correlation_id: correlationId,
          group_size: groupMessages.length,
        },
      });
      
      // Update all messages to initialized state if no caption found
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          processing_state: "initialized",
          group_caption_synced: false,
        })
        .eq("media_group_id", media_group_id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: false,
          error: "No caption or analyzed content found in group",
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the stored procedure to handle the group sync
    const { error: syncError } = await supabase.rpc(
      "process_media_group_analysis",
      {
        p_message_id: sourceMessage.id,
        p_media_group_id: media_group_id,
        p_analyzed_content: sourceMessage.analyzed_content || {},
        p_processing_completed_at: new Date().toISOString(),
        p_correlation_id: correlationId,
      }
    );

    if (syncError) {
      throw syncError;
    }

    // Update all messages in group to caption_ready state if they don't have analyzed content
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        processing_state: "caption_ready",
        group_caption_synced: true,
        message_caption_id: sourceMessage.id,
      })
      .eq("media_group_id", media_group_id)
      .is("analyzed_content", null);

    if (updateError) {
      throw updateError;
    }

    const totalDuration = Date.now() - startTime;
    logProcessingEvent({
      event: "SYNC_COMPLETED",
      message_id,
      media_group_id,
      duration_ms: totalDuration,
      state: "caption_ready",
      metadata: {
        correlation_id: correlationId,
        group_size: groupMessages.length,
        source_message_id: sourceMessage.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        source_message_id: sourceMessage.id,
        group_size: groupMessages.length,
        processing_time_ms: totalDuration,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorEvent = {
      event: "SYNC_FAILED",
      message_id: req.message_id,
      media_group_id: req.media_group_id,
      error: error.message,
      metadata: {
        correlation_id: correlationId,
        error_stack: error.stack,
        error_details: error,
      },
    };
    logProcessingEvent(errorEvent);

    return new Response(
      JSON.stringify({
        error: error.message,
        correlation_id: correlationId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});