import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ParsedContent } from './types.ts';
import { manualParse } from './manualParser.ts';
import { aiParse } from './aiParser.ts';
import { validateParsedContent } from './validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function mergeResults(manual: ParsedContent, ai: ParsedContent): ParsedContent {
  return {
    product_name: manual.product_name || ai.product_name || 'Untitled Product',
    product_code: manual.product_code || ai.product_code,
    vendor_uid: manual.vendor_uid || ai.vendor_uid,
    purchase_date: manual.purchase_date || ai.purchase_date,
    quantity: manual.quantity || ai.quantity,
    notes: manual.notes || ai.notes,
    parsing_metadata: {
      method: 'hybrid',
      confidence: Math.max(
        manual.parsing_metadata?.confidence || 0,
        ai.parsing_metadata?.confidence || 0
      ),
      fallbacks_used: [
        ...(manual.parsing_metadata?.fallbacks_used || []),
        ...(ai.parsing_metadata?.fallbacks_used || [])
      ],
      quantity_confidence: manual.parsing_metadata?.quantity_confidence || ai.parsing_metadata?.quantity_confidence,
      quantity_method: manual.parsing_metadata?.quantity_method || ai.parsing_metadata?.quantity_method,
      quantity_is_approximate: manual.parsing_metadata?.quantity_is_approximate || ai.parsing_metadata?.quantity_is_approximate,
      quantity_unit: manual.parsing_metadata?.quantity_unit || ai.parsing_metadata?.quantity_unit,
      quantity_original: manual.parsing_metadata?.quantity_original || ai.parsing_metadata?.quantity_original
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, caption } = await req.json();
    console.log(`Processing caption parsing for message ${message_id}`);

    if (!caption) {
      throw new Error('No caption provided for parsing');
    }

    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let finalResult = manualResult;

    if (!validateParsedContent(manualResult)) {
      console.log('Manual parsing incomplete, attempting AI parsing');
      try {
        const aiResult = await aiParse(caption);
        console.log('AI parsing result:', aiResult);
        finalResult = mergeResults(manualResult, aiResult);
        console.log('Merged parsing result:', finalResult);
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        parsed_content: finalResult,
        processing_state: 'completed'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed_content: finalResult 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error parsing caption:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to parse caption or update message'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});