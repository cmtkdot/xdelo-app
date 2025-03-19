
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { AnalyzedContent, MatchResult } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";
import { logEvent, LogEventType } from "@/lib/logUtils";

// Configuration
const CONFIG = {
  similarityThreshold: 0.7,
  weightedScoring: {
    productName: 0.4,
    vendorUid: 0.3,
    purchaseDate: 0.3
  },
  partialMatch: {
    enabled: true,
    vendorMinLength: 2,
    dateFormat: 'YYYY-MM-DD'
  }
};

/**
 * Find potential product matches for a message
 */
const findMatches = async (
  messageId: string,
  supabaseClient: SupabaseClient<Database>
): Promise<{ success: boolean; data?: { matches: MatchResult[]; bestMatch: MatchResult | null } }> => {
  try {
    // Fetch the message
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      console.error('Error fetching message:', messageError);
      return { success: false };
    }

    if (!message || !message.analyzed_content) {
      console.warn('No analyzed content found for message:', messageId);
      return { success: true, data: { matches: [], bestMatch: null } };
    }

    const analyzedContent = message.analyzed_content as AnalyzedContent;
    const { product_name, vendor_uid, purchase_date } = analyzedContent;

    if (!product_name && !vendor_uid && !purchase_date) {
      console.warn('Insufficient data for matching in message:', messageId);
      return { success: true, data: { matches: [], bestMatch: null } };
    }

    // Build product query
    let query = supabaseClient
      .from('gl_products')
      .select('*');

    if (product_name) {
      query = query.ilike('new_product_name', `%${product_name}%`);
    }

    const { data: products, error: productsError } = await query;

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return { success: false };
    }

    const matches: MatchResult[] = [];

    for (const product of products) {
      // Calculate matching confidence
      let confidence = 0;
      const matchedFields: string[] = [];
      const matchDetails: Record<string, any> = {};

      // Product name similarity matching
      if (product_name && product.new_product_name) {
        const similarity = stringSimilarity(product_name, product.new_product_name);
        matchDetails.nameScore = similarity;
        
        if (similarity > CONFIG.similarityThreshold) {
          confidence += similarity * CONFIG.weightedScoring.productName;
          matchedFields.push('product_name');
        }
      }

      // Vendor UID exact matching
      if (vendor_uid && product.vendor_product_name) {
        if (vendor_uid === product.vendor_product_name) {
          confidence += CONFIG.weightedScoring.vendorUid;
          matchedFields.push('vendor_uid');
          matchDetails.vendorMatch = true;
        } else if (CONFIG.partialMatch.enabled && vendor_uid.length >= CONFIG.partialMatch.vendorMinLength) {
          // Try partial vendor match (e.g., first few characters)
          const vendorPrefix = vendor_uid.substring(0, Math.min(vendor_uid.length, 3));
          if (product.vendor_product_name.startsWith(vendorPrefix)) {
            const partialScore = CONFIG.weightedScoring.vendorUid * 0.7; // 70% of vendor score for partial match
            confidence += partialScore;
            matchedFields.push('vendor_uid_partial');
            matchDetails.vendorPartialMatch = true;
          }
        }
      }

      // Purchase date matching
      if (purchase_date && product.product_purchase_date) {
        if (purchase_date === product.product_purchase_date) {
          confidence += CONFIG.weightedScoring.purchaseDate;
          matchedFields.push('purchase_date');
          matchDetails.dateMatch = true;
        } else if (CONFIG.partialMatch.enabled) {
          // Try comparing just month and year for partial date match
          const msgDate = new Date(purchase_date);
          const prodDate = new Date(product.product_purchase_date);
          
          if (msgDate.getFullYear() === prodDate.getFullYear() && 
              msgDate.getMonth() === prodDate.getMonth()) {
            const partialScore = CONFIG.weightedScoring.purchaseDate * 0.8; // 80% score for month+year match
            confidence += partialScore;
            matchedFields.push('purchase_date_partial');
            matchDetails.datePartialMatch = true;
          }
        }
      }

      if (confidence > 0) {
        matches.push({
          // Required core properties
          isMatch: true,
          score: confidence,
          matches: {
            product_name: {
              value: product.new_product_name || '',
              score: matchedFields.includes('product_name') ? confidence : 0
            }
          },
          // Additional properties
          id: product.id,
          message_id: messageId,
          product_id: product.id,
          confidence,
          match_fields: matchedFields,
          match_date: new Date().toISOString(),
          matchType: 'automatic',
          details: {
            matchedFields,
            confidence,
            ...matchDetails
          },
        });
      }
    }

    // Sort matches by confidence (descending)
    matches.sort((a, b) => b.confidence - a.confidence);

    const bestMatch = matches.length > 0 ? matches[0] : null;

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
    return { success: false };
  }
};

/**
 * Calculate string similarity using Jaro-Winkler distance
 * Returns a score between 0 (no similarity) and 1 (exact match)
 */
const stringSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;

  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  // Quick exact match check
  if (str1 === str2) return 1.0;

  // Calculate Jaro-Winkler similarity
  let matches = 0;
  let transpositions = 0;
  const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  // Find matching characters within match distance
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (!str2Matches[j] && str1[i] === str2[j]) {
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  // If no matches, return 0
  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1Matches[i]) {
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
  }

  // Calculate Jaro similarity
  const jaroSimilarity = (
    matches / str1.length +
    matches / str2.length +
    (matches - transpositions / 2) / matches
  ) / 3;

  // Apply Winkler modification (boost for common prefixes)
  let prefixLength = 0;
  const maxPrefixLength = 4;
  while (
    prefixLength < maxPrefixLength &&
    prefixLength < str1.length &&
    prefixLength < str2.length &&
    str1[prefixLength] === str2[prefixLength]
  ) {
    prefixLength++;
  }

  // Winkler scaling factor = 0.1
  return jaroSimilarity + prefixLength * 0.1 * (1 - jaroSimilarity);
};

/**
 * Log matching operation for auditing purposes
 */
const logMatchingOperation = async (
  messageId: string,
  matches: MatchResult[],
  bestMatch: MatchResult | null
) => {
  try {
    await logEvent(
      LogEventType.PRODUCT_MATCHING,
      messageId,
      {
        matchCount: matches.length,
        hasBestMatch: bestMatch !== null,
        bestMatchConfidence: bestMatch?.confidence || 0,
        bestMatchProductId: bestMatch?.product_id || null,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error('Error logging match operation:', error);
  }
};

/**
 * Match a message to potential products
 * @param messageId The message ID to find matches for
 * @returns Matching results with confidence scores
 */
export const matchProduct = async (messageId: string, supabaseClient: SupabaseClient<Database>) => {
  try {
    // Call findMatches to get the matches
    const { success, data } = await findMatches(messageId, supabaseClient);

    if (!success) {
      console.error('Error finding matches');
      return { success: false };
    }

    // Return the matches and bestMatch
    return {
      success: true,
      matches: data?.matches || [],
      bestMatch: data?.bestMatch || null,
    };
  } catch (error) {
    console.error('Error in matchProduct:', error);
    return { success: false };
  }
};

/**
 * Update a product in the database
 */
export const updateProduct = async (product: any) => {
  try {
    const { data, error } = await supabase
      .from('gl_products')
      .update(product)
      .eq('id', product.id)
      .select();

    if (error) {
      console.error('Error updating product:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error };
  }
};

/**
 * Batch match multiple messages to products
 * @param messageIds Array of message IDs to match
 */
export const batchMatchProducts = async (messageIds: string[], supabaseClient: SupabaseClient<Database> = supabase) => {
  try {
    const results = [];
    
    // Process in chunks to avoid overwhelming the database
    const chunkSize = 10;
    for (let i = 0; i < messageIds.length; i += chunkSize) {
      const chunk = messageIds.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(messageId => matchProduct(messageId, supabaseClient));
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }
    
    return { 
      success: true, 
      results,
      summary: {
        total: results.length,
        matched: results.filter(r => r.success && r.bestMatch).length,
        unmatched: results.filter(r => r.success && !r.bestMatch).length,
        failed: results.filter(r => !r.success).length
      }
    };
  } catch (error) {
    console.error('Error in batchMatchProducts:', error);
    return { success: false, error };
  }
};

export { findMatches, logMatchingOperation };
