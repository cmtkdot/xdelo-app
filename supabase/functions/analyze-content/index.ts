import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessingLog {
  event: string;
  message_id: string;
  media_group_id?: string;
  duration_ms?: number;
  state?: string;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

function logProcessingEvent(event: Omit<ProcessingLog, "timestamp">) {
  console.log(JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  }));
}

serve(async (req) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();
  logProcessingEvent({
    event: "ANALYSIS_STARTED",
    message_id: "pending",
    metadata: { correlation_id: correlationId }
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { message_id } = await req.json();
    logProcessingEvent({
      event: "MESSAGE_RECEIVED",
      message_id,
      metadata: { correlation_id: correlationId }
    });

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .maybeSingle();

    if (messageError) {
      logProcessingEvent({
        event: "DATABASE_ERROR",
        message_id,
        error: messageError.message,
        metadata: { correlation_id: correlationId }
      });
      throw messageError;
    }

    if (!message) {
      logProcessingEvent({
        event: "MESSAGE_NOT_FOUND",
        message_id,
        metadata: { correlation_id: correlationId }
      });
      throw new Error(`Message not found: ${message_id}`);
    }

    logProcessingEvent({
      event: "MESSAGE_FETCHED",
      message_id: message.id,
      media_group_id: message.media_group_id,
      metadata: {
        correlation_id: correlationId,
        caption_length: message.caption?.length,
        processing_state: message.processing_state
      }
    });

    // Analyze caption if present
    let analyzedContent = null;
    if (message.caption) {
      logProcessingEvent({
        event: "CAPTION_ANALYSIS_STARTED",
        message_id,
        metadata: { 
          correlation_id: correlationId,
          caption: message.caption
        }
      });

      analyzedContent = await analyzeCaption(message.caption);
      
      logProcessingEvent({
        event: "CAPTION_ANALYSIS_COMPLETED",
        message_id,
        metadata: { 
          correlation_id: correlationId,
          analyzed_content: analyzedContent
        }
      });
    }

    // Handle media group synchronization
    if (message.media_group_id) {
      logProcessingEvent({
        event: "GROUP_SYNC_STARTED",
        message_id,
        media_group_id: message.media_group_id,
        metadata: { correlation_id: correlationId }
      });
      
      const { error: groupError } = await supabase.rpc(
        "process_media_group_analysis",
        {
          p_message_id: message_id,
          p_media_group_id: message.media_group_id,
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlationId
        }
      );

      if (groupError) {
        logProcessingEvent({
          event: "GROUP_SYNC_ERROR",
          message_id,
          media_group_id: message.media_group_id,
          error: groupError.message,
          metadata: { correlation_id: correlationId }
        });
        throw groupError;
      }

      logProcessingEvent({
        event: "GROUP_SYNC_COMPLETED",
        message_id,
        media_group_id: message.media_group_id,
        metadata: { correlation_id: correlationId }
      });
    } else {
      // Single message update
      const { error: completeError } = await supabase
        .from("messages")
        .update({
          analyzed_content: analyzedContent,
          processing_state: "completed",
          processing_completed_at: new Date().toISOString(),
        })
        .eq("id", message_id);

      if (completeError) {
        logProcessingEvent({
          event: "COMPLETION_ERROR",
          message_id,
          error: completeError.message,
          metadata: { correlation_id: correlationId }
        });
        throw completeError;
      }
    }

    const duration = Date.now() - startTime;
    logProcessingEvent({
      event: "ANALYSIS_COMPLETED",
      message_id,
      duration_ms: duration,
      metadata: { 
        correlation_id: correlationId,
        has_analyzed_content: !!analyzedContent
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        processing_time_ms: duration,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logProcessingEvent({
      event: "ANALYSIS_FAILED",
      message_id: "unknown",
      error: error.message,
      duration_ms: duration,
      metadata: { 
        correlation_id: correlationId,
        error_stack: error.stack
      }
    });

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