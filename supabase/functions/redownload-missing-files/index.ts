
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { redownloadMissingFile } from '../telegram-webhook/mediaUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { messageIds, limit = 10 } = await req.json();
    const results = [];
    const errors = [];
    
    // Function to get messages that need redownload
    const getMessagesToRedownload = async (specificIds?: string[]) => {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('needs_redownload', true)
        .order('redownload_flagged_at', { ascending: true })
        .limit(limit);
        
      if (specificIds && specificIds.length > 0) {
        query = query.in('id', specificIds);
      }
      
      return await query;
    };
    
    // Get messages to process
    const { data: messages, error: fetchError } = await getMessagesToRedownload(messageIds);
    
    if (fetchError) {
      throw new Error(`Failed to fetch messages for redownload: ${fetchError.message}`);
    }
    
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No files found needing redownload",
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${messages.length} files flagged for redownload`);
    
    // Process each message sequentially
    for (const message of messages) {
      try {
        // Attempt to redownload the media file
        const result = await redownloadMissingFile(message);
        
        // Update message status after successful redownload
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            needs_redownload: false,
            redownload_attempted_at: new Date().toISOString(),
            redownload_success: true,
            error_message: null
          })
          .eq('id', message.id);
          
        if (updateError) {
          console.error(`Error updating message ${message.id} status after redownload:`, updateError);
        }
        
        results.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          success: true,
          public_url: result.public_url
        });
      } catch (error) {
        console.error(`Error redownloading file for message ${message.id}:`, error);
        
        // Update message with error information
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            redownload_attempted_at: new Date().toISOString(),
            redownload_success: false,
            redownload_failures: (message.redownload_failures || 0) + 1,
            error_message: error.message
          })
          .eq('id', message.id);
          
        if (updateError) {
          console.error(`Error updating message ${message.id} error status:`, updateError);
        }
        
        errors.push({
          message_id: message.id,
          file_unique_id: message.file_unique_id,
          error: error.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing redownload request:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
