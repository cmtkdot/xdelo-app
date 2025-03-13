import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface FixUrlsOptions {
  limit?: number;
  specific_ids?: string[];
  batch_size?: number;
  force_update?: boolean;
}

/**
 * Updates public_url for messages with storage paths but missing or invalid URLs
 */
async function handleRequest(req: Request): Promise<Response> {
  try {
    const correlationId = crypto.randomUUID();
    console.log(`[${correlationId}] Starting public URL fix operation`);
    
    // Get options from request body
    const options: FixUrlsOptions = await req.json().catch(() => ({}));
    const limit = options.limit || 500;
    const batchSize = options.batch_size || 100;
    const specificIds = options.specific_ids || [];
    const forceUpdate = options.force_update || false;
    
    console.log(`Processing with options: limit=${limit}, batchSize=${batchSize}, specificIds=${specificIds.length}, forceUpdate=${forceUpdate}`);
    
    // Get the Supabase URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    
    // Process in batches
    let processed = 0;
    let updated = 0;
    let failed = 0;
    const results = [];
    
    while (processed < limit) {
      // Build query to find messages needing URL updates
      let query = supabaseClient
        .from('messages')
        .select('id, storage_path, public_url, file_unique_id')
        .is('deleted_from_telegram', false)
        .is('storage_path', 'not.null')
        .not('storage_path', 'eq', '');
        
      if (specificIds.length > 0) {
        // If specific IDs provided, use those
        query = query.in('id', specificIds);
      } else if (!forceUpdate) {
        // Otherwise look for missing or invalid URLs
        query = query.or('public_url.is.null,public_url.eq.,public_url.not.ilike.%storage/v1/object/public/%');
      }
      
      // Apply limit for this batch
      query = query.limit(Math.min(batchSize, limit - processed));
      
      const { data: messages, error } = await query;
      
      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }
      
      if (!messages || messages.length === 0) {
        console.log(`No more messages to process after ${processed} records`);
        break;
      }
      
      console.log(`Processing batch of ${messages.length} messages`);
      
      // Update each message
      for (const message of messages) {
        try {
          if (!message.storage_path) {
            console.log(`Skipping message ${message.id} - no storage path`);
            failed++;
            continue;
          }
          
          // Generate the proper public URL using Supabase's built-in function
          const { data: { publicUrl } } = supabaseClient
            .storage
            .from('telegram-media')
            .getPublicUrl(message.storage_path);
          
          // Update the message
          const { error: updateError } = await supabaseClient
            .from('messages')
            .update({
              public_url: publicUrl,
              storage_exists: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
            
          if (updateError) {
            console.error(`Failed to update message ${message.id}: ${updateError.message}`);
            failed++;
            results.push({
              id: message.id,
              success: false,
              error: updateError.message
            });
          } else {
            updated++;
            results.push({
              id: message.id,
              success: true,
              old_url: message.public_url || 'none',
              new_url: publicUrl
            });
          }
        } catch (messageError) {
          console.error(`Error processing message ${message.id}: ${messageError.message}`);
          failed++;
          results.push({
            id: message.id,
            success: false,
            error: messageError.message
          });
        }
      }
      
      processed += messages.length;
      
      if (messages.length < batchSize) {
        // No more messages to process
        break;
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed,
        updated,
        failed,
        results: results.slice(0, 100), // Only return the first 100 results to avoid huge responses
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fixing public URLs:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
function handleOptions(req: Request): Response {
  return new Response('ok', { headers: corsHeaders });
}

// Main entry point
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }
  
  return await handleRequest(req);
});
