import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, caption } = await req.json();
    console.log('Processing request:', { message_id, has_caption: !!caption });

    if (!message_id) {
      throw new Error('message_id is required');
    }

    if (!caption) {
      throw new Error('No caption provided for analysis');
    }

    // Analyze the caption
    console.log('Starting caption analysis');
    const analyzedContent = await analyzeCaption(caption);
    console.log('Analysis completed:', analyzedContent);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent
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
        error: error.message,
        details: 'Failed to analyze caption'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});