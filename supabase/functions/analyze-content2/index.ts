import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    console.log(`[${correlationId}] Processing message:`, message_id);

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (messageError) throw messageError;
    if (!message) throw new Error("Message not found");
    if (!message.caption) {
      console.log(`[${correlationId}] No caption to analyze for message:`, message_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: "No caption to analyze",
          correlation_id: correlationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${correlationId}] Analyzing caption for message:`, message_id);
    const analyzedContent = await analyzeCaption(message.caption);

    const { error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: analyzedContent,
        processing_state: "analyzing",
        processing_started_at: new Date().toISOString(),
      })
      .eq("id", message_id);

    if (updateError) throw updateError;

    if (message.media_group_id) {
      console.log(`[${correlationId}] Processing media group:`, message.media_group_id);
      const { error: groupError } = await supabase.rpc(
        "process_media_group_analysis",
        {
          p_message_id: message_id,
          p_media_group_id: message.media_group_id,
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString(),
        }
      );

      if (groupError) throw groupError;
    } else {
      const { error: completeError } = await supabase
        .from("messages")
        .update({
          processing_state: "completed",
          processing_completed_at: new Date().toISOString(),
        })
        .eq("id", message_id);

      if (completeError) throw completeError;
    }

    const duration = Date.now() - startTime;
    console.log(`[${correlationId}] Analysis completed in ${duration}ms for message:`, message_id);

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
    console.error(`[${correlationId}] Error processing message:`, error);
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