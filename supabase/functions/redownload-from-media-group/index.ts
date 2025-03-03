
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
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
    const { messageId, mediaGroupId, fileUniqueId, limit = 10 } = await req.json();
    
    // Target specific messages or find candidates
    let query = supabase
      .from('messages')
      .select('*');
    
    if (messageId) {
      // Target a specific message
      query = query.eq('id', messageId);
    } else if (mediaGroupId && fileUniqueId) {
      // Find messages by media group and file_unique_id
      query = query
        .eq('media_group_id', mediaGroupId)
        .eq('file_unique_id', fileUniqueId)
        .eq('needs_redownload', true)
        .eq('redownload_strategy', 'media_group')
        .limit(limit);
    } else {
      // Find any message that needs redownload with media_group strategy
      query = query
        .eq('needs_redownload', true)
        .eq('redownload_strategy', 'media_group')
        .order('redownload_flagged_at', { ascending: true })
        .limit(limit);
    }
    
    const { data: messages, error } = await query;
    
    if (error) throw new Error(`Database query error: ${error.message}`);
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No messages found for media group recovery',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const results = [];
    const successful = [];
    const failed = [];
    
    // Process each message
    for (const message of messages) {
      try {
        const recoveryResult = await recoverFromMediaGroup(message);
        successful.push(message.id);
        results.push(recoveryResult);
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        failed.push(message.id);
        results.push({
          message_id: message.id,
          success: false,
          error: error.message
        });
        
        // Update the message with failure info
        await supabase
          .from('messages')
          .update({
            redownload_attempts: (message.redownload_attempts || 0) + 1,
            error_message: error.message,
            redownload_strategy: message.redownload_attempts >= 2 ? 'telegram_api' : 'media_group', // Change strategy after 2 attempts
            last_error_at: new Date().toISOString()
          })
          .eq('id', message.id);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: messages.length,
        successful: successful.length,
        failed: failed.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Recover file from another message in the same media group
 */
async function recoverFromMediaGroup(message) {
  if (!message.media_group_id) {
    throw new Error('Message is not part of a media group');
  }
  
  // Find another message in the same group with the same file_unique_id that has a valid file
  const { data: sourceMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', message.media_group_id)
    .eq('file_unique_id', message.file_unique_id)
    .neq('id', message.id)
    .eq('needs_redownload', false)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (!sourceMessages || sourceMessages.length === 0) {
    throw new Error('No source message found in media group');
  }
  
  const sourceMessage = sourceMessages[0];
  
  // Copy relevant file information
  const { error: updateError } = await supabase
    .from('messages')
    .update({
      needs_redownload: false,
      storage_path: sourceMessage.storage_path,
      public_url: sourceMessage.public_url,
      file_id: sourceMessage.file_id,
      file_id_expires_at: sourceMessage.file_id_expires_at,
      redownload_completed_at: new Date().toISOString(),
      error_message: null,
      redownload_strategy: null
    })
    .eq('id', message.id);
  
  if (updateError) {
    throw new Error(`Failed to update message: ${updateError.message}`);
  }
  
  // Log the recovery
  await supabase.from('unified_audit_logs').insert({
    event_type: 'media_group_recovery',
    entity_id: message.id,
    previous_state: { needs_redownload: true },
    new_state: { needs_redownload: false },
    metadata: {
      source_message_id: sourceMessage.id,
      media_group_id: message.media_group_id,
      file_unique_id: message.file_unique_id
    },
    event_timestamp: new Date().toISOString()
  });
  
  return {
    message_id: message.id,
    source_message_id: sourceMessage.id,
    media_group_id: message.media_group_id,
    file_unique_id: message.file_unique_id,
    success: true
  };
}
