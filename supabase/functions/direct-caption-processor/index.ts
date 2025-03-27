
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { messageId, caption, correlationId = crypto.randomUUID() } = await req.json();

    if (!messageId) {
      throw new Error('Message ID is required');
    }

    console.log(`Processing caption for message ${messageId}`);

    // Get the message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      throw new Error(`Could not find message: ${messageError?.message || 'Not found'}`);
    }

    // Prepare the response
    const response = {
      success: true,
      message_id: messageId,
      correlation_id: correlationId,
      processed_at: new Date().toISOString(),
      caption_updated: false,
      media_group_synced: false
    };

    // If caption is provided, update it
    if (caption && caption !== message.caption) {
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          caption,
          processing_state: 'caption_updated',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (updateError) {
        throw new Error(`Failed to update caption: ${updateError.message}`);
      }

      response.caption_updated = true;
    }

    // Call the caption analysis process
    const { data: analysisData, error: analysisError } = await supabase.functions.invoke('manual-caption-parser', {
      body: { 
        messageId,
        caption: caption || message.caption,
        correlationId
      }
    });

    if (analysisError) {
      throw new Error(`Failed to process caption: ${analysisError.message}`);
    }

    // Sync media group if this message belongs to one
    if (message.media_group_id) {
      try {
        const { data: syncResult, error: syncError } = await supabase.rpc(
          'xdelo_sync_media_group_content',
          {
            p_message_id: messageId,
            p_analyzed_content: analysisData.analyzed_content || message.analyzed_content,
            p_force_sync: true,
            p_sync_edit_history: true
          }
        );

        if (syncError) {
          console.error('Error syncing media group:', syncError);
        } else {
          response.media_group_synced = true;
        }
      } catch (syncErr) {
        console.error('Exception in media group sync:', syncErr);
      }
    }

    // Return success response
    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    // Log and return error
    console.error('Error processing caption:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), 
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
