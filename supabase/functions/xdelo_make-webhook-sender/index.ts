import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookSendRequest {
  webhookId: string;
  eventType: string;
  payload: any;
  context?: Record<string, any>;
  messageId?: string; // Optional message ID for Telegram-specific events
}

/**
 * Apply field selection to the payload based on webhook configuration
 */
function applyFieldSelection(payload: any, fieldSelection: any, eventType: string): any {
  if (!fieldSelection || !fieldSelection[eventType]) {
    return payload; // No field selection specified for this event type
  }

  const selection = fieldSelection[eventType];
  
  if (selection.mode === 'include') {
    // Include only specified fields
    const result: Record<string, any> = {};
    for (const field of selection.fields) {
      const paths = field.split('.');
      let value = payload;
      let valid = true;
      
      for (const path of paths) {
        if (value === undefined || value === null) {
          valid = false;
          break;
        }
        value = value[path];
      }
      
      if (valid) {
        // Handle nested paths (e.g., "user.name")
        let current = result;
        for (let i = 0; i < paths.length - 1; i++) {
          const path = paths[i];
          if (!current[path]) current[path] = {};
          current = current[path];
        }
        current[paths[paths.length - 1]] = value;
      }
    }
    return result;
  } else if (selection.mode === 'exclude') {
    // Exclude specified fields
    const result = { ...payload };
    for (const field of selection.fields) {
      const paths = field.split('.');
      let current = result;
      
      for (let i = 0; i < paths.length - 1; i++) {
        const path = paths[i];
        if (!current[path]) break;
        current = current[path];
      }
      
      delete current[paths[paths.length - 1]];
    }
    return result;
  }
  
  return payload; // Default to returning the original payload
}

/**
 * Apply template-based payload formatting
 */
function applyPayloadTemplate(payload: any, template: any, eventType: string): any {
  if (!template || !template[eventType]) {
    return payload; // No template specified for this event type
  }
  
  const templateObj = template[eventType];
  
  // Function to recursively process template values
  function processTemplate(templateValue: any): any {
    if (typeof templateValue === 'string' && templateValue.startsWith('{{') && templateValue.endsWith('}}')) {
      // Extract the path from the template string (e.g., "{{user.name}}" -> "user.name")
      const path = templateValue.slice(2, -2).trim();
      const paths = path.split('.');
      
      // Resolve the value from the payload
      let value = payload;
      for (const p of paths) {
        if (value === undefined || value === null) return null;
        value = value[p];
      }
      return value;
    } else if (typeof templateValue === 'object' && templateValue !== null) {
      // Recursively process object properties
      if (Array.isArray(templateValue)) {
        return templateValue.map(item => processTemplate(item));
      } else {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(templateValue)) {
          result[key] = processTemplate(value);
        }
        return result;
      }
    }
    
    // Return literals unchanged
    return templateValue;
  }
  
  return processTemplate(templateObj);
}

/**
 * Apply custom transformation code to the payload
 */
function applyTransformationCode(payload: any, code: string, eventType: string, context: any): any {
  if (!code) return payload;
  
  try {
    // Create a safe sandbox for executing the transformation code
    const sandboxFunc = new Function('payload', 'eventType', 'context', `
      "use strict";
      try {
        ${code}
        return payload;
      } catch (error) {
        return { error: error.message, originalPayload: payload };
      }
    `);
    
    // Execute the transformation code
    return sandboxFunc(payload, eventType, context);
  } catch (error) {
    console.error('Error executing transformation code:', error);
    return { 
      error: 'Failed to execute transformation code', 
      message: error.message,
      originalPayload: payload 
    };
  }
}

/**
 * Get Telegram message data if messageId is provided
 */
async function getTelegramMessageData(messageId: string | undefined): Promise<any | null> {
  if (!messageId) return null;
  
  try {
    // Fetch message data from the database
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching Telegram message data:', error);
    return null;
  }
}

/**
 * Check if a delivery should be retried based on the retry configuration
 */
function shouldRetry(
  log: any, 
  retryConfig: { max_retries: number; retry_delay: number; exponential_backoff: boolean } | null
): boolean {
  if (!retryConfig || !log.error_message) return false;
  
  const retryCount = log.retry_count || 0;
  return retryCount < retryConfig.max_retries;
}

/**
 * Calculate next retry time based on retry configuration
 */
function calculateNextRetryTime(
  retryCount: number,
  retryConfig: { max_retries: number; retry_delay: number; exponential_backoff: boolean } | null
): Date | null {
  if (!retryConfig) return null;
  
  const now = new Date();
  let delayMs = retryConfig.retry_delay * 1000; // Convert to milliseconds
  
  if (retryConfig.exponential_backoff) {
    delayMs = delayMs * Math.pow(2, retryCount);
  }
  
  now.setTime(now.getTime() + delayMs);
  return now;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { webhookId, eventType, payload, context = {}, messageId } = await req.json() as WebhookSendRequest;
    
    if (!webhookId) {
      return new Response(
        JSON.stringify({ error: 'Missing webhookId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!eventType) {
      return new Response(
        JSON.stringify({ error: 'Missing eventType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Missing payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch webhook configuration
    const { data: webhook, error: webhookError } = await supabase
      .from('make_webhook_configs')
      .select('*')
      .eq('id', webhookId)
      .single();
    
    if (webhookError || !webhook) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if webhook is active and handles this event type
    if (!webhook.is_active) {
      return new Response(
        JSON.stringify({ error: 'Webhook is inactive' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!webhook.event_types.includes(eventType)) {
      return new Response(
        JSON.stringify({ error: 'Webhook does not handle this event type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get Telegram message data if messageId is provided
    const messageData = await getTelegramMessageData(messageId);
    
    // Merge message data with payload if available
    const fullPayload = messageData ? { ...payload, message: messageData } : payload;
    
    // Process payload through transformations
    let transformedPayload = fullPayload;
    
    // Step 1: Apply field selection
    transformedPayload = applyFieldSelection(transformedPayload, webhook.field_selection, eventType);
    
    // Step 2: Apply template formatting
    if (webhook.payload_template) {
      transformedPayload = applyPayloadTemplate(transformedPayload, webhook.payload_template, eventType);
    }
    
    // Step 3: Apply custom transformation code
    if (webhook.transformation_code) {
      transformedPayload = applyTransformationCode(
        transformedPayload, 
        webhook.transformation_code, 
        eventType, 
        context
      );
    }
    
    // Create an event log entry
    const { data: logEntry, error: logError } = await supabase
      .from('make_event_logs')
      .insert({
        webhook_id: webhookId,
        event_type: eventType,
        payload: transformedPayload,
        status: 'pending',
        context: { ...context, messageId },
        retry_count: 0
      })
      .select()
      .single();
    
    if (logError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create log entry', details: logError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare headers for the webhook request
    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Webhook-ID': webhookId,
      'X-Event-Type': eventType,
      'X-Event-ID': logEntry.id,
      ...(webhook.headers || {})
    };
    
    // Send the webhook request
    const startTime = Date.now();
    let responseCode, responseBody, responseHeaders, errorMessage;
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(transformedPayload),
      });
      
      responseCode = response.status;
      responseBody = await response.text();
      responseHeaders = Object.fromEntries(response.headers.entries());
      
      // Check if the response indicates an error
      if (responseCode >= 400) {
        errorMessage = `HTTP error ${responseCode}`;
      }
    } catch (error) {
      responseCode = 0;
      errorMessage = error.message;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Determine if we should retry based on the error and retry configuration
    const shouldRetryDelivery = shouldRetry({ 
      error_message: errorMessage,
      retry_count: 0
    }, webhook.retry_config);
    
    const nextRetryTime = shouldRetryDelivery 
      ? calculateNextRetryTime(0, webhook.retry_config)
      : null;
    
    // Update the log entry with results
    await supabase
      .from('make_event_logs')
      .update({
        status: errorMessage ? (shouldRetryDelivery ? 'pending' : 'failed') : 'success',
        error_message: errorMessage,
        request_headers: requestHeaders,
        response_code: responseCode,
        response_body: responseBody,
        response_headers: responseHeaders,
        duration_ms: duration,
        completed_at: errorMessage && shouldRetryDelivery ? null : new Date().toISOString(),
        next_retry_at: nextRetryTime ? nextRetryTime.toISOString() : null,
        retry_count: shouldRetryDelivery ? 1 : 0
      })
      .eq('id', logEntry.id);
    
    return new Response(
      JSON.stringify({
        success: !errorMessage,
        eventId: logEntry.id,
        responseCode,
        duration,
        willRetry: shouldRetryDelivery,
        nextRetryAt: nextRetryTime ? nextRetryTime.toISOString() : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
