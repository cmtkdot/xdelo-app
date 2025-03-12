
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/types.ts';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Create Supabase client
const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Log function to standardize logging
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    level,
    function: 'xdelo_standardize_storage_paths',
    message,
    ...(data && { data })
  }));
}

// Main handler for standardizing storage paths
Deno.serve(async (req) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { limit = 100, dryRun = false, messageIds = [] } = await req.json();
    
    // Validate inputs
    if (limit < 1 || limit > 1000) {
      throw new Error('Limit must be between 1 and 1000');
    }

    log('info', 'Starting storage path standardization', { limit, dryRun, messageIds });

    let result;
    let error = null;

    // If specific messageIds are provided, standardize only those
    if (messageIds.length > 0) {
      log('info', `Processing ${messageIds.length} specific messages`);
      
      // Loop through each messageId and standardize its storage path
      const results = [];
      for (const messageId of messageIds) {
        const { data, error: rpcError } = await supabase.rpc('xdelo_fix_storage_paths', {
          p_limit: 1,
          p_only_check: dryRun,
          p_message_ids: [messageId]
        });
        
        if (rpcError) {
          log('error', `Error fixing storage path for message ${messageId}`, rpcError);
          error = rpcError;
        } else {
          results.push(...(data || []));
        }
      }
      
      result = {
        fixed: results.filter(r => r.fixed).length,
        skipped: results.filter(r => !r.fixed).length,
        needs_redownload: results.filter(r => r.needs_redownload).length,
        details: results
      };
    } else {
      // Process in bulk based on limit
      log('info', `Processing up to ${limit} messages in bulk`);
      const { data, error: rpcError } = await supabase.rpc('xdelo_fix_storage_paths', {
        p_limit: limit,
        p_only_check: dryRun
      });
      
      if (rpcError) {
        log('error', 'Error fixing storage paths', rpcError);
        error = rpcError;
      } else {
        result = {
          fixed: data.filter(r => r.fixed).length,
          skipped: data.filter(r => !r.fixed).length,
          needs_redownload: data.filter(r => r.needs_redownload).length,
          details: data
        };
      }
    }

    // Log success
    const finalResult = {
      success: !error,
      message: error ? error.message : `Standardized storage paths (${result.fixed} fixed, ${result.skipped} skipped)`,
      stats: result,
      error: error ? error.message : null
    };
    
    log('info', 'Completed storage path standardization', finalResult);

    // Return response with CORS headers
    return new Response(
      JSON.stringify(finalResult),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    // Log and return error
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    log('error', 'Function execution failed', { error: errorMessage });
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error processing request',
        error: errorMessage
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
