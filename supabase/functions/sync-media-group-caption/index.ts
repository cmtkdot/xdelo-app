import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    
    // Validate caption
    if (!caption || caption.trim() === '') {
      console.log('Invalid or empty caption, skipping sync');
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Caption is required and cannot be empty'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log('Processing media group sync:', { message_id, media_group_id, caption });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Only sync if the caption is valid
    const { error } = await supabase.rpc('sync_media_group_caption', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_caption: caption.trim()
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Media group sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-media-group:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});