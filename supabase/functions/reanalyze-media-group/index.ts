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
    const { media_group_id, message_id } = await req.json();
    
    console.log('Starting reanalysis for:', { media_group_id, message_id });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call the fix_media_groups function
    const { data, error } = await supabase
      .rpc('fix_media_groups');

    if (error) {
      console.error('Error calling fix_media_groups:', error);
      throw error;
    }

    // Log reanalysis completion
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'REANALYSIS_REQUESTED',
      old_state: 'pending',
      new_state: 'completed',
      processing_details: {
        reanalysis_timestamp: new Date().toISOString(),
        is_media_group: !!media_group_id
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Reanalysis completed successfully'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in reanalyze-media-group:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});