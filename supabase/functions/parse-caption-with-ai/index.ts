import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";
import { validateAnalyzedContent } from "./validator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption, correlation_id } = await req.json();
    
    console.log('Starting caption analysis:', { message_id, media_group_id, correlation_id });

    if (!caption || typeof caption !== 'string' || caption.trim() === '') {
      throw new Error('Caption is required and must be a non-empty string');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Analyze the caption using AI
    const analyzedContent = await analyzeCaption(caption);
    
    // Validate the analyzed content
    if (!validateAnalyzedContent(analyzedContent)) {
      console.error('Validation failed for analyzed content:', analyzedContent);
      throw new Error('Invalid analyzed content structure');
    }

    console.log('Caption analyzed successfully:', analyzedContent);

    // Use process_media_group_content function to update the database
    const { error: processError } = await supabase.rpc('process_media_group_content', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_analyzed_content: analyzedContent,
      p_correlation_id: correlation_id || crypto.randomUUID()
    });

    if (processError) {
      console.error('Error processing media group:', processError);
      throw processError;
    }

    console.log('Media group processed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Caption parsed and processed successfully',
        analyzed_content: analyzedContent,
        correlation_id: correlation_id
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        correlation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});