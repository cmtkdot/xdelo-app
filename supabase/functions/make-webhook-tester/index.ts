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

interface WebhookTestRequest {
  webhookId: string;
  testPayload?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webhookId, testPayload } = await req.json() as WebhookTestRequest;
    
    if (!webhookId) {
      return new Response(
        JSON.stringify({ success: false, error: "webhookId is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Get webhook configuration
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
        JSON.stringify({ success: false, error: "Cannot test an inactive webhook" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Create event log entry
    const eventLog = {
      webhook_id: webhookId,
      event_type: "webhook_test",
      payload: testPayload || { test: true, timestamp: new Date().toISOString() },
      status: "pending",
      created_at: new Date().toISOString(),
    };
    
    const { data: logEntry, error: logError } = await supabase
      .from("make_event_logs")
      .insert(eventLog)
      .select()
      .single();
    
    if (logError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create log entry: ${logError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Send test request to webhook
    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let responseHeaders: Record<string, string> | null = null;
    let error: string | null = null;
    
    try {
      const headers = {
        "Content-Type": "application/json",
        "X-Webhook-Event": "webhook_test",
        "X-Webhook-ID": webhookId,
        "X-Event-ID": logEntry.id,
      };
      
      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(eventLog.payload),
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
        "X-Webhook-Event": "webhook_test",
        "X-Webhook-ID": webhookId,
        "X-Event-ID": logEntry.id,
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
          testResult: {
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
        message: "Webhook test completed",
        status: logUpdate.status,
        logId: logEntry.id,
        testResult: {
          ...logUpdate,
          id: logEntry.id,
          webhook_id: webhookId,
          event_type: "webhook_test",
          payload: eventLog.payload,
          created_at: eventLog.created_at,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error testing webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}); 