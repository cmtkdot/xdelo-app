
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { getSupabaseClient, handleError } from "../_shared/supabase.ts"
import { AnalysisRequest, AnalyzedContent } from "../_shared/types.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { messageId, caption, correlationId } = await req.json() as AnalysisRequest;

    if (!messageId || !caption) {
      throw new Error('Message ID and caption are required');
    }

    const supabase = getSupabaseClient();

    console.log('Starting caption analysis:', {
      message_id: messageId,
      caption_length: caption.length,
      correlation_id: correlationId
    });

    // Call your manual parsing function first
    // If that doesn't yield good results, proceed with AI analysis
    const analyzedContent: AnalyzedContent = {
      product_name: '', // Extract from caption
      vendor_uid: '',   // Extract from caption
      quantity: 0,      // Extract from caption
      purchase_date: new Date().toISOString(),
      parsing_metadata: {
        method: 'manual',
        confidence: 1.0,
        timestamp: new Date().toISOString(),
        correlation_id: correlationId || crypto.randomUUID()
      }
    };

    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed_content: analyzedContent 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    return handleError(error);
  }
});
