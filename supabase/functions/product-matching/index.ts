
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { findProductMatches, findBestMatch } from './matchingUtils.ts'

console.log('Product matching function started')

interface WebhookPayload {
  type: 'MATCH_PRODUCT' | 'BULK_MATCH';
  request?: {
    productName: string;
    vendorName?: string;
    poNumber?: string;
    vendorUid?: string;
    purchaseDate?: string;
    minConfidence?: number;
  };
  message_ids?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: WebhookPayload = await req.json()
    
    if (payload.type === 'MATCH_PRODUCT') {
      if (!payload.request) {
        throw new Error('Match request is required')
      }
      
      const { productName, vendorName, poNumber, vendorUid, purchaseDate, minConfidence } = payload.request
      
      if (!productName) {
        throw new Error('Product name is required')
      }
      
      const { data: products, error: queryError } = await supabaseClient
        .from('gl_products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (queryError) {
        throw new Error(`Failed to fetch products: ${queryError.message}`)
      }
      
      const matches = findProductMatches(
        products, 
        productName, 
        vendorName, 
        poNumber, 
        vendorUid, 
        minConfidence || 0.6
      )
      
      const bestMatch = findBestMatch(matches)
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            matches,
            bestMatch
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (payload.type === 'BULK_MATCH') {
      if (!payload.message_ids || !Array.isArray(payload.message_ids)) {
        throw new Error('message_ids array is required for bulk matching')
      }
      
      const { data: messages, error: messagesError } = await supabaseClient
        .from('messages')
        .select('*')
        .in('id', payload.message_ids)
      
      if (messagesError) {
        throw new Error(`Failed to fetch messages: ${messagesError.message}`)
      }
      
      const { data: products, error: productsError } = await supabaseClient
        .from('gl_products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (productsError) {
        throw new Error(`Failed to fetch products: ${productsError.message}`)
      }
      
      const matchResults = []
      
      for (const message of messages) {
        const matches = findProductMatches(
          products,
          message.product_name || '',
          undefined,
          message.po_number,
          message.vendor_uid,
          0.6
        )
        
        const bestMatch = findBestMatch(matches)
        
        if (bestMatch && bestMatch.confidence_score >= 0.6) {
          const { error: matchError } = await supabaseClient
            .from('sync_matches')
            .upsert({
              message_id: message.id,
              product_id: bestMatch.product_id,
              match_priority: bestMatch.match_priority,
              confidence_score: bestMatch.confidence_score,
              match_details: bestMatch.match_details,
              status: bestMatch.confidence_score >= 0.75 ? 'approved' : 'pending',
              applied: bestMatch.confidence_score >= 0.75
            })
          
          if (matchError) {
            console.error(`Error recording match for message ${message.id}:`, matchError)
            continue
          }
          
          if (bestMatch.confidence_score >= 0.75) {
            await supabaseClient
              .from('messages')
              .update({
                glide_row_id: bestMatch.glide_id,
                product_to_messages_low_confidence: false,
                last_match_attempt_at: new Date().toISOString()
              })
              .eq('id', message.id)
          }
          
          matchResults.push({
            messageId: message.id,
            match: bestMatch
          })
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            matches: matchResults.map(r => r.match),
            bestMatch: null
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      throw new Error('Invalid operation type')
    }
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
