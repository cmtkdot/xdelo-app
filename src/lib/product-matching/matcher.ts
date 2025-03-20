import { supabase } from "@/integrations/supabase/client";
import { SupabaseClient } from "@supabase/supabase-js";
import { calculateStringSimilarity } from "./similarity";
import { logEvent, LogEventType } from "@/lib/logUtils";
import { Database } from "@/integrations/supabase/types";
import { BatchMatchResult, MatchLogMetadata, MatchResult, MatchableProduct, ProductMatchingConfig } from "./types";
import { AnalyzedContent } from "@/types";
import { fetchMatchingConfig } from "./config";

/**
 * Find matches for a message by ID
 */
export async function findMatches(
  messageId: string,
  supabaseClient: SupabaseClient<Database> = supabase,
  customConfig?: ProductMatchingConfig
): Promise<{
  success: boolean;
  data?: { matches: MatchResult[]; bestMatch: MatchResult | null };
  error?: string;
}> {
  try {
    // Fetch configuration if not provided
    const config = customConfig || await fetchMatchingConfig();
    
    // Fetch the message
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      console.error('Error fetching message:', messageError);
      return { success: false, error: `Failed to fetch message: ${messageError.message}` };
    }

    if (!message || !message.analyzed_content) {
      console.warn('No analyzed content found for message:', messageId);
      return { 
        success: true, 
        data: { 
          matches: [], 
          bestMatch: null 
        } 
      };
    }

    // Extract data from analyzed content
    const analyzedContent = message.analyzed_content as AnalyzedContent;
    const { product_name, vendor_uid, purchase_date } = analyzedContent;

    if (!product_name && !vendor_uid && !purchase_date) {
      console.warn('Insufficient data for matching in message:', messageId);
      return { 
        success: true, 
        data: { 
          matches: [], 
          bestMatch: null 
        } 
      };
    }

    // Build product query
    let query = supabaseClient
      .from('gl_products')
      .select('*');

    // Enhance query based on available data
    if (product_name) {
      query = query.ilike('new_product_name', `%${product_name}%`);
    }

    const { data: products, error: productsError } = await query;

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return { 
        success: false, 
        error: `Failed to fetch products: ${productsError.message}` 
      };
    }

    // Match products
    const { matches, bestMatch } = matchProductsToMessage(
      products as MatchableProduct[],
      {
        productName: product_name,
        vendorUid: vendor_uid,
        purchaseDate: purchase_date
      },
      messageId,
      config
    );

    // Log the matching operation
    await logMatchingOperation(messageId, matches, bestMatch);

    return {
      success: true,
      data: {
        matches,
        bestMatch
      }
    };
  } catch (error) {
    console.error('Error in findMatches:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Match a message to products
 */
export function matchProductsToMessage(
  products: MatchableProduct[],
  messageData: {
    productName?: string;
    vendorUid?: string;
    purchaseDate?: string;
  },
  messageId: string,
  config: ProductMatchingConfig
): { matches: MatchResult[]; bestMatch: MatchResult | null } {
  const matches: MatchResult[] = [];
  const { productName, vendorUid, purchaseDate } = messageData;

  for (const product of products) {
    // Calculate matching confidence
    let confidence = 0;
    const matchedFields: string[] = [];
    const matchDetails: Record<string, any> = {};
    const matchResults: MatchResult['matches'] = {
      product_name: {
        value: product.new_product_name || '',
        score: 0
      }
    };

    // Product name similarity matching
    if (productName && product.new_product_name) {
      const similarity = calculateStringSimilarity(
        productName, 
        product.new_product_name,
        {
          useJaroWinkler: config.algorithm.useJaroWinkler,
          useLevenshtein: config.algorithm.useLevenshtein
        }
      );
      
      matchDetails.nameScore = similarity;
      matchResults.product_name.score = similarity;
      
      if (similarity > config.similarityThreshold) {
        confidence += similarity * config.weights.productName;
        matchedFields.push('product_name');
      }
    }

    // Vendor UID exact matching
    if (vendorUid && (product.vendor_uid || product.vendor_product_name)) {
      const vendorIdToMatch = product.vendor_uid || product.vendor_product_name;
      
      matchResults.vendor_uid = {
        value: vendorIdToMatch || '',
        score: 0
      };
      
      if (vendorIdToMatch && vendorUid === vendorIdToMatch) {
        confidence += config.weights.vendorUid;
        matchedFields.push('vendor_uid');
        matchDetails.vendorMatch = true;
        matchResults.vendor_uid.score = 1;
      } else if (config.partialMatch.enabled && vendorUid.length >= config.partialMatch.vendorMinLength && vendorIdToMatch) {
        // Try partial vendor match (e.g., first few characters)
        const vendorPrefix = vendorUid.substring(0, Math.min(vendorUid.length, 3));
        if (vendorIdToMatch.startsWith(vendorPrefix)) {
          const partialScore = config.weights.vendorUid * 0.7; // 70% of vendor score for partial match
          confidence += partialScore;
          matchedFields.push('vendor_uid_partial');
          matchDetails.vendorPartialMatch = true;
          matchResults.vendor_uid.score = 0.7;
        }
      }
    }

    // Purchase date matching
    if (purchaseDate && product.product_purchase_date) {
      matchResults.purchase_date = {
        value: product.product_purchase_date || '',
        score: 0
      };
      
      if (purchaseDate === product.product_purchase_date) {
        confidence += config.weights.purchaseDate;
        matchedFields.push('purchase_date');
        matchDetails.dateMatch = true;
        matchResults.purchase_date.score = 1;
      } else if (config.partialMatch.enabled) {
        // Try comparing just month and year for partial date match
        try {
          const msgDate = new Date(purchaseDate);
          const prodDate = new Date(product.product_purchase_date);
          
          if (msgDate.getFullYear() === prodDate.getFullYear() && 
              msgDate.getMonth() === prodDate.getMonth()) {
            const partialScore = config.weights.purchaseDate * 0.8; // 80% score for month+year match
            confidence += partialScore;
            matchedFields.push('purchase_date_partial');
            matchDetails.datePartialMatch = true;
            matchResults.purchase_date.score = 0.8;
          }
        } catch (e) {
          // Handle invalid date formats
          console.warn('Invalid date format in purchase date comparison:', e);
        }
      }
    }

    // Only add matches that meet the minimum confidence threshold
    if (confidence >= config.minConfidence) {
      matches.push({
        isMatch: true,
        score: confidence,
        confidence,
        product_id: product.id,
        message_id: messageId,
        match_fields: matchedFields,
        matchedFields: matchedFields, // For backward compatibility
        match_date: new Date().toISOString(),
        matchType: confidence > 0.8 ? 'automatic' : 'partial',
        details: {
          matchedFields,
          confidence,
          ...matchDetails
        },
        matches: matchResults
      });
    }
  }

  // Sort matches by confidence (descending)
  matches.sort((a, b) => b.confidence - a.confidence);

  return {
    matches,
    bestMatch: matches.length > 0 ? matches[0] : null
  };
}

/**
 * Match a product by message ID
 */
export async function matchProduct(
  messageId: string, 
  supabaseClient: SupabaseClient<Database> = supabase
): Promise<{
  success: boolean;
  data?: {
    bestMatch: MatchResult | null;
  };
  error?: string;
}> {
  try {
    const result = await findMatches(messageId, supabaseClient);
    
    if (!result.success) {
      return result;
    }
    
    const { bestMatch } = result.data!;
    
    // If we have a high confidence match, update the message with the product ID
    if (bestMatch && bestMatch.confidence >= 0.75) {
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          glide_row_id: bestMatch.product_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
      if (updateError) {
        console.error('Error updating message with product ID:', updateError);
      }
    }
    
    return {
      success: true,
      data: {
        bestMatch
      }
    };
  } catch (error) {
    console.error('Error in matchProduct:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Batch match multiple messages to products
 */
export async function batchMatchProducts(
  messageIds: string[],
  supabaseClient: SupabaseClient<Database> = supabase
): Promise<BatchMatchResult> {
  try {
    const config = await fetchMatchingConfig();
    const results = [];
    let matched = 0;
    let unmatched = 0;
    let failed = 0;
    
    for (const messageId of messageIds) {
      try {
        const result = await findMatches(messageId, supabaseClient, config);
        
        if (!result.success) {
          failed++;
          results.push({
            messageId,
            success: false,
            bestMatch: null,
            error: result.error
          });
          continue;
        }
        
        const { bestMatch } = result.data!;
        
        if (bestMatch) {
          matched++;
          
          // If we have a high confidence match, update the message with the product ID
          if (bestMatch.confidence >= 0.75) {
            const { error: updateError } = await supabaseClient
              .from('messages')
              .update({
                glide_row_id: bestMatch.product_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', messageId);
              
            if (updateError) {
              console.error('Error updating message with product ID:', updateError);
            }
          }
        } else {
          unmatched++;
        }
        
        results.push({
          messageId,
          success: true,
          bestMatch
        });
      } catch (error) {
        console.error(`Error matching message ${messageId}:`, error);
        failed++;
        results.push({
          messageId,
          success: false,
          bestMatch: null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      success: true,
      results,
      summary: {
        total: messageIds.length,
        matched,
        unmatched,
        failed
      }
    };
  } catch (error) {
    console.error('Error in batchMatchProducts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Log product matching operation
 */
async function logMatchingOperation(
  messageId: string,
  matches: MatchResult[],
  bestMatch: MatchResult | null
): Promise<void> {
  try {
    const metadata: MatchLogMetadata = {
      messageId,
      hasMatch: !!bestMatch,
      confidence: bestMatch?.confidence,
      matchedProductId: bestMatch?.product_id,
      matchedFields: bestMatch?.match_fields
    };
    
    await logEvent(
      LogEventType.PRODUCT_MATCHING,
      `Product matching for message ${messageId}`,
      metadata
    );
  } catch (error) {
    console.error('Error logging matching operation:', error);
  }
} 