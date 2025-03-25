
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

interface RetryResult {
  id: string;
  status: 'success' | 'failed' | 'retry';
  error?: string;
  responseCode?: number;
  nextRetryAt?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting webhook retry worker process');
    
    // Find failed webhook deliveries that are due for retry
    const now = new Date().toISOString();
    const { data: pendingRetries, error: fetchError } = await supabase
      .from('make_event_logs')
      .select('id, webhook_id, event_type, payload, retry_count, context')
      .eq('status', 'pending')
      .not('webhook_id', 'is', null)
      .not('error_message', 'is', null)
      .lt('next_retry_at', now)
      .order('next_retry_at', { ascending: true })
      .limit(10); // Process in small batches
    
    if (fetchError) {
      throw new Error(`Error fetching pending retries: ${fetchError.message}`);
    }
    
    console.log(`Found ${pendingRetries?.length || 0} pending webhook retries`);
    
    if (!pendingRetries || pendingRetries.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending retries found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process each retry
    const results: RetryResult[] = [];
    
    for (const retry of pendingRetries) {
      console.log(`Processing retry for event ${retry.id}`);
      
      try {
        // Get the webhook configuration to check retry settings
        const { data: webhook, error: webhookError } = await supabase
          .from('make_webhook_configs')
          .select('*')
          .eq('id', retry.webhook_id)
          .single();
        
        if (webhookError || !webhook) {
          console.error(`Webhook not found: ${retry.webhook_id}`);
          
          // Update log to failed status since webhook doesn't exist
          await supabase
            .from('make_event_logs')
            .update({
              status: 'failed',
              error_message: `Webhook configuration not found: ${retry.webhook_id}`,
              completed_at: now
            })
            .eq('id', retry.id);
          
          results.push({
            id: retry.id,
            status: 'failed',
            error: `Webhook configuration not found: ${retry.webhook_id}`
          });
          
          continue;
        }
        
        // Check if webhook is still active
        if (!webhook.is_active) {
          console.log(`Webhook ${retry.webhook_id} is inactive, marking retry as failed`);
          
          await supabase
            .from('make_event_logs')
            .update({
              status: 'failed',
              error_message: 'Webhook is inactive',
              completed_at: now
            })
            .eq('id', retry.id);
          
          results.push({
            id: retry.id,
            status: 'failed',
            error: 'Webhook is inactive'
          });
          
          continue;
        }
        
        // Check if retry is still within max retries
        const retryConfig = webhook.retry_config || { max_retries: 3, retry_delay: 60, exponential_backoff: true };
        
        if (retry.retry_count >= retryConfig.max_retries) {
          console.log(`Retry count ${retry.retry_count} exceeds max retries ${retryConfig.max_retries}`);
          
          await supabase
            .from('make_event_logs')
            .update({
              status: 'failed',
              error_message: `Max retry attempts (${retryConfig.max_retries}) exceeded`,
              completed_at: now
            })
            .eq('id', retry.id);
          
          results.push({
            id: retry.id,
            status: 'failed',
            error: `Max retry attempts (${retryConfig.max_retries}) exceeded`
          });
          
          continue;
        }
        
        // Prepare headers for the webhook request
        const requestHeaders = {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhook.id,
          'X-Event-Type': retry.event_type,
          'X-Event-ID': retry.id,
          'X-Retry-Count': retry.retry_count.toString(),
          ...(webhook.headers || {})
        };
        
        console.log(`Attempting retry ${retry.retry_count + 1} for event ${retry.id}`);
        
        // Send the webhook request
        const startTime = Date.now();
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(retry.payload),
        });
        
        const responseCode = response.status;
        const responseBody = await response.text();
        const responseHeaders = Object.fromEntries(response.headers.entries());
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        let errorMessage = null;
        let status: 'success' | 'failed' | 'pending' = 'success';
        let nextRetryAt = null;
        
        // Check if response indicates an error
        if (responseCode >= 400) {
          errorMessage = `HTTP error ${responseCode}`;
          
          // Check if we should try again
          if (retry.retry_count + 1 < retryConfig.max_retries) {
            status = 'pending';
            const nextRetryTime = new Date();
            const retryDelay = retryConfig.retry_delay * 1000; // Convert to milliseconds
            
            if (retryConfig.exponential_backoff) {
              nextRetryTime.setTime(nextRetryTime.getTime() + retryDelay * Math.pow(2, retry.retry_count));
            } else {
              nextRetryTime.setTime(nextRetryTime.getTime() + retryDelay);
            }
            
            nextRetryAt = nextRetryTime.toISOString();
          } else {
            status = 'failed';
          }
        }
        
        // Update the log with results
        await supabase
          .from('make_event_logs')
          .update({
            status,
            error_message: errorMessage,
            request_headers: requestHeaders,
            response_code: responseCode,
            response_body: responseBody,
            response_headers: responseHeaders,
            duration_ms: duration,
            completed_at: status === 'success' ? now : null,
            retry_count: retry.retry_count + 1,
            next_retry_at: nextRetryAt
          })
          .eq('id', retry.id);
        
        results.push({
          id: retry.id,
          status: status === 'pending' ? 'retry' : status,
          responseCode,
          error: errorMessage,
          nextRetryAt
        });
        
      } catch (error) {
        console.error(`Error processing retry for event ${retry.id}:`, error);
        
        // Calculate next retry time
        const webhook = await supabase
          .from('make_webhook_configs')
          .select('retry_config')
          .eq('id', retry.webhook_id)
          .single();
        
        const retryConfig = webhook.data?.retry_config || 
          { max_retries: 3, retry_delay: 60, exponential_backoff: true };
        
        let status: 'failed' | 'pending' = 'failed';
        let nextRetryAt = null;
        
        if (retry.retry_count + 1 < retryConfig.max_retries) {
          status = 'pending';
          const nextRetryTime = new Date();
          const retryDelay = retryConfig.retry_delay * 1000; // Convert to milliseconds
          
          if (retryConfig.exponential_backoff) {
            nextRetryTime.setTime(nextRetryTime.getTime() + retryDelay * Math.pow(2, retry.retry_count));
          } else {
            nextRetryTime.setTime(nextRetryTime.getTime() + retryDelay);
          }
          
          nextRetryAt = nextRetryTime.toISOString();
        }
        
        // Update the log with error
        await supabase
          .from('make_event_logs')
          .update({
            status,
            error_message: `Retry error: ${error.message}`,
            retry_count: retry.retry_count + 1,
            next_retry_at: nextRetryAt,
            completed_at: status === 'failed' ? now : null
          })
          .eq('id', retry.id);
        
        results.push({
          id: retry.id,
          status: status === 'pending' ? 'retry' : status,
          error: error.message,
          nextRetryAt
        });
      }
    }
    
    return new Response(
      JSON.stringify({ 
        processed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Webhook retry worker error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
