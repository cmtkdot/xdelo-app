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
    const { message_id, caption, analyzed_content } = await req.json();
    console.log('Starting reanalysis for message:', { message_id, caption });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get message details including media_group_id
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) throw messageError;

    // If this is part of a media group, find the original caption message
    if (message.media_group_id) {
      console.log('Message is part of media group:', message.media_group_id);
      
      const { data: groupMessages, error: groupError } = await supabase
        .from('messages')
        .select('*')
        .eq('media_group_id', message.media_group_id)
        .order('created_at', { ascending: true });

      if (groupError) throw groupError;

      // Find JPEG image with caption or use the first message
      const originalMessage = groupMessages.find(msg => 
        msg.mime_type === 'image/jpeg' && msg.caption
      ) || groupMessages[0];

      if (originalMessage && originalMessage.id !== message_id) {
        console.log('Found original message:', originalMessage.id);
        message_id = originalMessage.id;
      }
    }

    // Trigger reanalysis
    const { error: reanalysisError } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: { 
        message_id,
        media_group_id: message.media_group_id,
        caption: caption || message.caption,
        force_reanalysis: true
      }
    });

    if (reanalysisError) throw reanalysisError;

    // Log reanalysis attempt
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id: message.media_group_id,
      event_type: 'REANALYSIS_TRIGGERED',
      old_state: 'completed',
      new_state: 'processing',
      analyzed_content: {
        ...analyzed_content,
        parsing_metadata: {
          ...analyzed_content?.parsing_metadata,
          reanalysis_attempted: true
        }
      }
    });

    return new Response(
      JSON.stringify({ message: 'Reanalysis triggered successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error triggering reanalysis:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});