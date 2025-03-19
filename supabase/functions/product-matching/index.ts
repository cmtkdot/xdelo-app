
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { findBestProductMatch } from './matching-utils.ts'
import { ProductMatchRequest, ProductMatchResponse, GlProduct } from './types.ts'

console.log('Product matching function started')

interface WebhookPayload {
  type: string;
  request?: ProductMatchRequest;
  messageIds?: string[];
  batch?: boolean;
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

    const payload = await req.json();
    
    // Handle different request types
    if (payload.messageIds && Array.isArray(payload.messageIds)) {
      // This is a batch request with multiple message IDs
      const response = await processBulkMatch(payload.messageIds, supabaseClient);
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (payload.request) {
      // This is a single product match request
      const response = await processProductMatch(payload.request, supabaseClient);
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      throw new Error('Invalid request format. Expected "messageIds" array or "request" object.');
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

async function processProductMatch(
  request: ProductMatchRequest,
  supabase: any
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
  message_ids: string[],
  supabase: any
): Promise<ProductMatchResponse> {
  try {
    console.log(`Processing batch match for ${message_ids.length} messages`);
    
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, product_name, vendor_uid, purchase_date, analyzed_content')
      .in('id', message_ids)

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`)
    }

    console.log(`Found ${messages.length} messages to process`);

    const { data: products, error: productsError } = await supabase
      .from('gl_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`)
    }

    console.log(`Found ${products.length} products for matching`);
    
    const glProducts = products as GlProduct[];
    const matchResults = [];

    for (const message of messages) {
      try {
        console.log(`Processing message ${message.id}`);
        
        // Extract product data from message or analyzed_content
        const productName = message.product_name || (message.analyzed_content?.product_name as string) || '';
        const vendorUid = message.vendor_uid || (message.analyzed_content?.vendor_uid as string) || '';
        const purchaseDate = message.purchase_date || (message.analyzed_content?.purchase_date as string) || '';
        
        const { matches, bestMatch } = findBestProductMatch(
          glProducts,
          productName,
          '',  // vendorName - not typically in messages
          '',  // poNumber - not typically in messages
          vendorUid,
          purchaseDate
        );

        // If we have a match with sufficient confidence, record it
        if (bestMatch && bestMatch.confidence >= 0.6) {
          try {
            const { error: matchError } = await supabase
              .from('sync_matches')
              .upsert({
                message_id: message.id,
                product_id: bestMatch.product_id,
                confidence: bestMatch.confidence,
                match_fields: bestMatch.matchedFields || [],
                status: bestMatch.confidence >= 0.75 ? 'approved' : 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (matchError) {
              console.error(`Error recording match for message ${message.id}:`, matchError);
            }
            
            // If high confidence, update the message record
            if (bestMatch.confidence >= 0.75) {
              await supabase
                .from('messages')
                .update({
                  glide_row_id: bestMatch.product_id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', message.id);
            }
          } catch (dbError) {
            console.error(`Database error for message ${message.id}:`, dbError);
          }
        }

        // Add detailed result to our response
        matchResults.push({
          success: true,
          messageId: message.id,
          message_id: message.id,  // For compatibility
          productName: productName,
          vendorUid: vendorUid,
          bestMatch: bestMatch ? {
            ...bestMatch,
            message_id: message.id,
            product_name: (products.find(p => p.id === bestMatch.product_id) || {}).new_product_name || 'Unknown'
          } : null
        });
      } catch (messageError) {
        console.error(`Error processing message ${message.id}:`, messageError);
        matchResults.push({
          success: false,
          messageId: message.id,
          message_id: message.id,
          error: messageError.message
        });
      }
    }

    return {
      success: true,
      results: matchResults,
      summary: {
        total: matchResults.length,
        matched: matchResults.filter(r => r.success && r.bestMatch).length,
        unmatched: matchResults.filter(r => r.success && !r.bestMatch).length,
        failed: matchResults.filter(r => !r.success).length
      }
    }
  } catch (error) {
    console.error('Error in bulk matching:', error);
    return {
      success: false,
      error: error.message
    }
  }
}
