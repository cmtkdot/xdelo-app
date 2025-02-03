import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { message_id } = await req.json();
    logProcessingEvent({
      event: "ANALYSIS_STARTED",
      message_id,
      metadata: { correlation_id: correlationId }
    });

    // Fetch message details
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

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
      throw new Error(`Message not found: ${message_id}`);
    }

    // Analyze caption
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

    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: analyzedContent,
        processing_state: "completed",
        processing_completed_at: new Date().toISOString(),
      })
      .eq("id", message_id);

    if (updateError) {
      throw updateError;
    }

    // If part of a media group, sync the content
    if (message.media_group_id) {
      const { error: groupUpdateError } = await supabase
        .from("messages")
        .update({
          analyzed_content: analyzedContent,
          processing_state: "completed",
          processing_completed_at: new Date().toISOString(),
          group_caption_synced: true,
          message_caption_id: message_id
        })
        .eq("media_group_id", message.media_group_id)
        .neq("id", message_id);

      if (groupUpdateError) {
        throw groupUpdateError;
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