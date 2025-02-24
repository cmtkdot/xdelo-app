import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Message, MatchResult, AnalyzedContent } from "@/types";

const similarityThreshold = 0.7;

const findMatches = async (
  messageId: string,
  supabaseClient: SupabaseClient<Database>
): Promise<{ success: boolean; data?: { matches: MatchResult[]; bestMatch: MatchResult | null } }> => {
  try {
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

    let query = supabaseClient
      .from('gl_products')
      .select('*');

    if (product_name) {
      query = query.ilike('main_product_name', `%${product_name}%`);
    }

    const { data: products, error: productsError } = await query;

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return { success: false };
    }

    const matches: MatchResult[] = [];

    for (const product of products) {
      let similarity = 0;
      const matchedFields: string[] = [];

      if (product_name && product.main_product_name) {
        const nameSimilarity = stringSimilarity(product_name, product.main_product_name);
        if (nameSimilarity > similarityThreshold) {
          similarity += nameSimilarity * 0.4;
          matchedFields.push('product_name');
        }
      }

      if (vendor_uid && product.main_vendor_uid) {
        if (vendor_uid === product.main_vendor_uid) {
          similarity += 0.3;
          matchedFields.push('vendor_uid');
        }
      }

      if (purchase_date && product.main_product_purchase_date) {
        if (purchase_date === product.main_product_purchase_date) {
          similarity += 0.3;
          matchedFields.push('purchase_date');
        }
      }

      if (similarity > 0) {
        matches.push({
          id: crypto.randomUUID(),
          message_id: messageId,
          product_id: product.id,
          similarity,
          product,
          match_type: similarity > 0.8 ? 'exact' : similarity > 0.6 ? 'partial' : 'fuzzy',
          match_confidence: similarity,
          matched_fields: matchedFields,
          details: {
            matchedFields,
            confidence: similarity
          }
        });
      }
    }

    matches.sort((a, b) => b.match_confidence - a.match_confidence);

    const bestMatch = matches.length > 0 ? matches[0] : null;

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

const stringSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;

  str1 = str1.toLowerCase();
  str2 = str2.toLowerCase();

  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;

  let matches = 0;
  let transpositions = 0;
  const str1Flags = new Array(str1.length).fill(false);
  const str2Flags = new Array(str2.length).fill(false);

  const searchRange = Math.floor(maxLength / 2) - 1;

  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - searchRange);
    const end = Math.min(str2.length, i + searchRange + 1);

    for (let j = start; j < end; j++) {
      if (str1[i] === str2[j] && !str2Flags[j]) {
        str1Flags[i] = true;
        str2Flags[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1Flags[i]) {
      while (!str2Flags[k] && k < str2.length) {
        k++;
      }

      if (str1[i] !== str2[k]) {
        transpositions++;
      }

      k++;
    }
  }

  const jaro = (matches / str1.length + matches / str2.length + (matches - transpositions / 2) / matches) / 3;

  return jaro;
};

export function calculateMatchConfidence(message: any, product: any): MatchResult {
  const matchedFields: string[] = [];
  let overallConfidence = 0;

  if (message.product_name && product.main_product_name) {
    const nameSimilarity = stringSimilarity(message.product_name, product.main_product_name);
    if (nameSimilarity > similarityThreshold) {
      overallConfidence += nameSimilarity * 0.4;
      matchedFields.push('product_name');
    }
  }

  if (message.vendor_uid && product.main_vendor_uid) {
    if (message.vendor_uid === product.main_vendor_uid) {
      overallConfidence += 0.3;
      matchedFields.push('vendor_uid');
    }
  }

  if (message.purchase_date && product.main_product_purchase_date) {
    if (message.purchase_date === product.main_product_purchase_date) {
      overallConfidence += 0.3;
      matchedFields.push('purchase_date');
    }
  }

  return {
    id: Math.random().toString(),
    message_id: message.id,
    product_id: product.id,
    confidence: overallConfidence,
    matchType: 'automatic',
    match_confidence: overallConfidence,
    details: {
      matchedFields,
      confidence: overallConfidence
    }
  };
}

export { findMatches };
