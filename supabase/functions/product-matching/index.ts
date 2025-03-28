import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { findBestProductMatch } from './matching-utils.ts'
import { ProductMatchRequest, ProductMatchResponse, GlProduct } from './types.ts'

console.log('Product matching function started')

// Define payload interfaces
interface WebhookPayload {
  type?: string;
  request?: ProductMatchRequest;
  messageIds?: string[];
  batch?: boolean;
  customText?: string;
  config?: Record<string, any>;
}

// Default configuration
const DEFAULT_CONFIG = {
  similarityThreshold: 0.7,
  minConfidence: 0.6,
  weights: {
    productName: 0.4,
    vendorUid: 0.3,
    purchaseDate: 0.3
  },
  partialMatch: {
    enabled: true
  },
  algorithm: {
    useJaroWinkler: true
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json() as WebhookPayload;
    
    // Handle different request types
    if (payload.messageIds && Array.isArray(payload.messageIds)) {
      // This is a batch request with multiple message IDs
      const response = await processBulkMatch(
        payload.messageIds, 
        supabaseClient,
        payload.config ?? DEFAULT_CONFIG
      );
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (payload.request || payload.customText) {
      // This is a single product match request
      const response = await processProductMatch(
        payload.request ?? { customText: payload.customText },
        supabaseClient,
        payload.config ?? DEFAULT_CONFIG
      );
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
  request: ProductMatchRequest & { customText?: string },
  supabase: any,
  config: Record<string, any>
): Promise<{
  success: boolean;
  data?: { matches: Array<any>; bestMatch: any | null };
  error?: string;
}> {
  try {
    // Handle custom text if provided
    if (request.customText) {
      // Fetch products for matching
      const { data: products, error: queryError } = await supabase
        .from('gl_products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (queryError) {
        throw new Error(`Failed to fetch products: ${queryError.message}`);
      }

      console.log(`Matching custom text against ${products.length} products`);

      // Analyze custom text to extract product name, vendor, etc.
      // This is a simplified version - in a real app, you might use NLP or other analysis
      const { matches, bestMatch } = findBestProductMatch(
        products as GlProduct[],
        request.customText,
        '', // vendorName
        '', // poNumber
        '', // vendorUid
        '', // purchaseDate
        request.minConfidence ?? config.minConfidence ?? 0.6
      );

      return {
        success: true,
        data: {
          matches,
          bestMatch
        }
      };
    } 
    // Handle message ID if provided
    else if (request.messageId) {
      // Fetch the message to analyze
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', request.messageId)
        .single();

      if (messageError) {
        throw new Error(`Failed to fetch message: ${messageError.message}`);
      }

      if (!message) {
        throw new Error(`Message not found with ID: ${request.messageId}`);
      }

      // Fetch products for matching
      const { data: products, error: queryError } = await supabase
        .from('gl_products')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (queryError) {
        throw new Error(`Failed to fetch products: ${queryError.message}`);
      }

      console.log(`Matching message ${request.messageId} against ${products.length} products`);

      // Extract product information from the message
      const analyzedContent = message.analyzed_content || {};
      const productName = analyzedContent.product_name || message.caption || '';
      const vendorUid = analyzedContent.vendor_uid || '';
      const purchaseDate = analyzedContent.purchase_date || '';

      // Find matches
      const { matches, bestMatch } = findBestProductMatch(
        products as GlProduct[],
        productName,
        '', // vendorName
        '', // poNumber
        vendorUid,
        purchaseDate,
        request.minConfidence ?? config.minConfidence ?? 0.6
      );

      return {
        success: true,
        data: {
          matches,
          bestMatch
        }
      };
    } else {
      throw new Error('Missing required parameter: messageId or customText');
    }
  } catch (error) {
    console.error('Error in product matching:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during product matching'
    };
  }
}

async function processBulkMatch(
  message_ids: string[],
  supabase: any,
  config: Record<string, any>
): Promise<{
  success: boolean;
  results?: any[];
  summary?: { total: number; matched: number; unmatched: number; failed: number };
  error?: string;
}> {
  try {
    console.log(`Processing batch match for ${message_ids.length} messages`);
    
    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, caption, analyzed_content')
      .in('id', message_ids);

    if (messagesError) {
      throw new Error(`Failed to fetch messages: ${messagesError.message}`);
    }

    console.log(`Found ${messages.length} messages to process`);

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('gl_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    console.log(`Found ${products.length} products for matching`);
    
    const matchResults = [];
    let matched = 0;
    let unmatched = 0;
    let failed = 0;

    // Process each message
    for (const message of messages) {
      try {
        console.log(`Processing message ${message.id}`);
        
        // Extract product data from message or analyzed_content
        const analyzedContent = message.analyzed_content || {};
        const productName = analyzedContent.product_name || message.caption || '';
        const vendorUid = analyzedContent.vendor_uid || '';
        const purchaseDate = analyzedContent.purchase_date || '';
        
        // Find matches
        const { matches, bestMatch } = findBestProductMatch(
          products as GlProduct[],
          productName,
          '', // vendorName
          '', // poNumber
          vendorUid,
          purchaseDate,
          config.minConfidence ?? 0.6
        );

        // If we have a match with sufficient confidence, record it
        if (bestMatch && bestMatch.confidence_score >= (config.minConfidence ?? 0.6)) {
          try {
            // Insert match record
            const { error: matchError } = await supabase
              .from('sync_matches')
              .upsert({
                message_id: message.id,
                product_id: bestMatch.product_id,
                confidence: bestMatch.confidence_score,
                match_fields: bestMatch.match_criteria ? 
                  Object.entries(bestMatch.match_criteria)
                    .filter(([_, value]) => value === true)
                    .map(([key]) => key) : 
                  [],
                status: bestMatch.confidence_score >= 0.75 ? 'approved' : 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (matchError) {
              console.error(`Error recording match for message ${message.id}:`, matchError);
            }
            
            // If high confidence, update the message record
            if (bestMatch.confidence_score >= 0.75) {
              await supabase
                .from('messages')
                .update({
                  glide_row_id: bestMatch.product_id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', message.id);
            }
            
            matched++;
          } catch (dbError) {
            console.error(`Database error for message ${message.id}:`, dbError);
            failed++;
          }
        } else {
          unmatched++;
        }

        // Add detailed result to our response
        matchResults.push({
          success: true,
          messageId: message.id,
          message_id: message.id,  // For backward compatibility
          productName,
          vendorUid,
          bestMatch: bestMatch ? {
            ...bestMatch,
            message_id: message.id,
            product_name: (products.find((p: any) => p.id === bestMatch.product_id) || {}).new_product_name || 'Unknown'
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
        failed++;
      }
    }

    return {
      success: true,
      results: matchResults,
      summary: {
        total: matchResults.length,
        matched,
        unmatched,
        failed
      }
    };
  } catch (error) {
    console.error('Error in bulk matching:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during bulk matching'
    };
  }
}
