
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookRetryRequest {
  eventId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId } = await req.json() as WebhookRetryRequest;
    
    if (!eventId) {
      return new Response(
        JSON.stringify({ success: false, error: "eventId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Get the original event
    const { data: originalEvent, error: eventError } = await supabase
      .from("make_event_logs")
      .select("*, make_webhook_configs(*)")
      .eq("id", eventId)
      .single();
    
    if (eventError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to find event: ${eventError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }
    
    // Check if the original webhook still exists and is active
    const webhookId = originalEvent.webhook_id;
    if (!webhookId) {
      return new Response(
        JSON.stringify({ success: false, error: "Event doesn't have an associated webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    const { data: webhook, error: webhookError } = await supabase
      .from("make_webhook_configs")
      .select("*")
      .eq("id", webhookId)
      .single();
    
    if (webhookError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to find webhook: ${webhookError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }
    
    if (!webhook.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Cannot retry with an inactive webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Create a new event log entry for the retry
    const newEventLog = {
      webhook_id: webhookId,
      event_type: originalEvent.event_type,
      payload: originalEvent.payload,
      status: "pending",
      created_at: new Date().toISOString(),
      tags: ["retry"],
      context: {
        original_event_id: eventId,
        retry_requested_at: new Date().toISOString()
      }
    };
    
    const { data: logEntry, error: logError } = await supabase
      .from("make_event_logs")
      .insert(newEventLog)
      .select()
      .single();
    
    if (logError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create log entry: ${logError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Send request to webhook
    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let responseHeaders: Record<string, string> | null = null;
    let error: string | null = null;
    
    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Webhook-Event": originalEvent.event_type,
        "X-Webhook-ID": webhookId,
        "X-Event-ID": logEntry.id,
        "X-Original-Event-ID": eventId,
        "X-Retry": "true"
      };
      
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(originalEvent.payload),
      });
      
      responseStatus = response.status;
      responseBody = await response.text();
      
      // Convert headers to plain object
      responseHeaders = {};
      for (const [key, value] of response.headers.entries()) {
        responseHeaders[key] = value;
      }
    } catch (e) {
      error = e.message;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Update log entry with results
    const logUpdate = {
      status: error ? "failed" : responseStatus && responseStatus >= 200 && responseStatus < 300 ? "success" : "failed",
      error_message: error,
      response_code: responseStatus,
      response_body: responseBody,
      response_headers: responseHeaders,
      request_headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": originalEvent.event_type,
        "X-Webhook-ID": webhookId,
        "X-Event-ID": logEntry.id,
        "X-Original-Event-ID": eventId,
        "X-Retry": "true"
      },
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    };
    
    const { error: updateError } = await supabase
      .from("make_event_logs")
      .update(logUpdate)
      .eq("id", logEntry.id);
    
    if (updateError) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to update log entry: ${updateError.message}`,
          retryResult: {
            ...logUpdate,
            id: logEntry.id,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook retry completed",
        status: logUpdate.status,
        originalEventId: eventId,
        retryEventId: logEntry.id,
        retryResult: {
          ...logUpdate,
          id: logEntry.id,
          webhook_id: webhookId,
          event_type: originalEvent.event_type,
          payload: originalEvent.payload,
          created_at: newEventLog.created_at,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error retrying webhook event:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
