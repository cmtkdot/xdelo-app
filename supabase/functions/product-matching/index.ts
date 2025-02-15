import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { findBestProductMatch } from './matching-utils.ts'
import { ProductMatchRequest, ProductMatchResponse, GlProduct } from './types.ts'

console.log('Product matching function started')

interface WebhookPayload {
  type: 'MATCH_PRODUCT' | 'BULK_MATCH';
  request?: ProductMatchRequest;
  messageIds?: string[];
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
    let response: ProductMatchResponse;

    switch (payload.type) {
      case 'MATCH_PRODUCT':
        if (!payload.request) {
          throw new Error('Match request is required')
        }
        response = await processProductMatch(payload.request, supabaseClient)
        break
      
      case 'BULK_MATCH':
        if (!payload.messageIds || !Array.isArray(payload.messageIds)) {
          throw new Error('Message IDs array is required for bulk matching')
        }
        response = await processBulkMatch(payload.messageIds, supabaseClient)
        break

      default:
        throw new Error('Invalid operation type')
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
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

async function processProductMatch(
  request: ProductMatchRequest,
  supabase: SupabaseClient
): Promise<ProductMatchResponse> {
  try {
    const { data: products, error: queryError } = await supabase
      .from('gl_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (queryError) {
      throw new Error(`Failed to fetch products: ${queryError.message}`)
    }

    const { matches, bestMatch } = findBestProductMatch(
      products as GlProduct[],
      request.productName,
      request.vendorName,
      request.poNumber,
      request.vendorUid,
      request.purchaseDate,
      request.minConfidence
    )

    return {
      success: true,
      data: {
        matches,
        bestMatch
      }
    }
  } catch (error) {
    console.error('Error in product matching:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function processBulkMatch(
  messageIds: string[],
  supabase: SupabaseClient
): Promise<ProductMatchResponse> {
  try {
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .in('id', messageIds)

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`)
    }

    const { data: products, error: productsError } = await supabase
      .from('gl_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    const glProducts = products as GlProduct[];
    const matchResults = [];

    for (const message of messages) {
      const { matches, bestMatch } = findBestProductMatch(
        glProducts,
        message.product_name || '',
        message.vendor_uid,
        message.po_number,
        message.vendor_uid,
        message.purchase_date
      )

      if (bestMatch && bestMatch.confidence_score >= 0.6) {
        const { error: matchError } = await supabase
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
          await supabase
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

    return {
      success: true,
      data: {
        matches: matchResults.map(r => r.match),
        bestMatch: null
      }
    }
  } catch (error) {
    console.error('Error in bulk matching:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
