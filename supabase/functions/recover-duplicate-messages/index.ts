
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().toString();
  
  try {
    const { limit = 50, dryRun = true } = await req.json();
    
    // Log operation start
    await logProcessingEvent(
      'recover_duplicates_started',
      'system',
      correlationId,
      { limit, dryRun }
    );
    
    // Find duplicates with file_unique_id present multiple times
    const { data: duplicates, error: findError } = await supabaseClient
      .from('messages')
      .select('file_unique_id, count(*)')
      .not('file_unique_id', 'is', null)
      .group('file_unique_id')
      .having('count(*)', 'gt', 1)
      .limit(limit);
      
    if (findError) {
      throw new Error(`Error finding duplicates: ${findError.message}`);
    }
    
    console.log(`Found ${duplicates?.length || 0} duplicate file_unique_ids`);
    
    let processed = 0;
    let errors = 0;
    
    // Process each duplicate set
    for (const dupGroup of duplicates || []) {
      try {
        const fileUniqueId = dupGroup.file_unique_id;
        
        // Get all messages with this file_unique_id
        const { data: messages, error: msgError } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('file_unique_id', fileUniqueId)
          .order('created_at', { ascending: true });
          
        if (msgError) {
          throw new Error(`Error fetching messages for ${fileUniqueId}: ${msgError.message}`);
        }
        
        if (!messages || messages.length <= 1) continue;
        
        // First message is the original, others are duplicates
        const original = messages[0];
        const duplicates = messages.slice(1);
        
        console.log(`Processing ${fileUniqueId}: 1 original + ${duplicates.length} duplicates`);
        
        // Mark duplicates
        for (const dup of duplicates) {
          if (!dryRun) {
            const { error: updateError } = await supabaseClient
              .from('messages')
              .update({
                is_duplicate: true,
                duplicate_reference_id: original.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', dup.id);
              
            if (updateError) {
              errors++;
              console.error(`Error updating duplicate ${dup.id}: ${updateError.message}`);
              continue;
            }
          }
          processed++;
        }
      } catch (dupError) {
        errors++;
        console.error(`Error processing duplicate group: ${dupError.message}`);
      }
    }
    
    const resultSummary = {
      success: true,
      processed,
      errors,
      dryRun,
      duplicateGroups: duplicates?.length || 0
    };
    
    // Log completion
    await logProcessingEvent(
      'recover_duplicates_completed',
      'system',
      correlationId,
      resultSummary
    );
    
    return new Response(
      JSON.stringify(resultSummary),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  } catch (error) {
    console.error(`Error in recover-duplicate-messages:`, error);
    
    // Log error
    await logProcessingEvent(
      'recover_duplicates_error',
      'system',
      correlationId,
      {},
      error.message
    );
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlationId
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});
