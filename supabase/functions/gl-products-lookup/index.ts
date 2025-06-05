
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

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
    const correlationId = crypto.randomUUID().toString();
    const { productIds, limit = 50 } = await req.json();
    
    // Log the operation
    await logProcessingEvent(
      'gl_products_lookup',
      'system',
      correlationId,
      { productIds, limit }
    );
    
    // Check if we have product IDs to look up
    if (productIds && Array.isArray(productIds) && productIds.length > 0) {
      const { data, error } = await supabaseClient
        .from('gl_products')
        .select('*')
        .in('id', productIds)
        .limit(limit);
        
      if (error) {
        throw new Error(`Error fetching products: ${error.message}`);
      }
      
      return new Response(
        JSON.stringify(data || []),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    // If no product IDs provided, return recent products
    const { data, error } = await supabaseClient
      .from('gl_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      throw new Error(`Error fetching recent products: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify(data || []),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Error in gl-products-lookup:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlationId: crypto.randomUUID().toString()
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});
