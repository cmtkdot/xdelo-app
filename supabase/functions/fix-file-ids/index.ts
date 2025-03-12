import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { xdelo_retryDownload } from "../_shared/mediaUtils.ts";

// Create a Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get Telegram bot token
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN env variable');
}

interface RequestBody {
  messageId?: string;  // Single message ID to fix
  errorCode?: string;  // Error code to filter by
  limit?: number;      // Maximum messages to process
  dryRun?: boolean;    // If true, don't actually fix anything
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = crypto.randomUUID();
    const { messageId, errorCode, limit = 10, dryRun = false } = await req.json() as RequestBody;
    
    // Case 1: Fix a single message
    if (messageId) {
      console.log(`Attempting to fix file_id for message: ${messageId}`);
      
      const result = await xdelo_retryDownload(messageId, TELEGRAM_BOT_TOKEN);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Case 2: Fix messages with specific error code or all errors
    console.log(`Finding messages with download errors, limit: ${limit}, error code: ${errorCode || 'any'}`);
    
    // Build query to find messages with errors
    let query = supabase
      .from('messages')
      .select('id, file_id, file_unique_id, mime_type, error_code, error_message, redownload_attempts, media_group_id')
      .is('storage_exists', false)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    // Add error code filter if provided
    if (errorCode) {
      query = query.eq('error_code', errorCode);
    } else {
      // Otherwise look for any error or missing file
      query = query.or('error_message.is.not.null,needs_redownload.eq.true');
    }
    
    const { data: messagesToFix, error: queryError } = await query;
    
    if (queryError) {
      throw new Error(`Error querying messages: ${queryError.message}`);
    }
    
    if (!messagesToFix || messagesToFix.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No messages found that need fixing',
          data: { processed: 0 } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${messagesToFix.length} messages to fix`);
    
    if (dryRun) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Dry run completed', 
          data: { messagesToFix, processed: 0 } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process each message
    const results = [];
    for (const message of messagesToFix) {
      console.log(`Processing message ${message.id}`);
      try {
        const result = await xdelo_retryDownload(message.id, TELEGRAM_BOT_TOKEN);
        results.push({
          messageId: message.id,
          success: result.success,
          message: result.message
        });
        
        // Log to audit trail
        await supabase.from('unified_audit_logs').insert({
          event_type: result.success ? 'file_redownloaded' : 'file_redownload_failed',
          entity_id: message.id,
          correlation_id: correlationId,
          metadata: {
            file_unique_id: message.file_unique_id,
            error_code: message.error_code,
            result: result.message
          }
        });
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        results.push({
          messageId: message.id,
          success: false,
          message: error.message
        });
      }
    }
    
    // Summarize results
    const successCount = results.filter(r => r.success).length;
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} messages, fixed ${successCount}`,
        data: {
          processed: results.length,
          succeeded: successCount,
          failed: results.length - successCount,
          results
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fix-file-ids:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
        error: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
