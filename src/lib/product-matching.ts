import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Message, MatchResult, AnalyzedContent } from "@/types";

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
      let confidence = 0;
      const matchedFields: string[] = [];

      if (product_name && product.main_product_name) {
        const similarity = stringSimilarity(product_name, product.main_product_name);
        if (similarity > similarityThreshold) {
          confidence += similarity * 0.4;
          matchedFields.push('product_name');
        }
      }

      if (vendor_uid && product.main_vendor_uid) {
        if (vendor_uid === product.main_vendor_uid) {
          confidence += 0.3;
          matchedFields.push('vendor_uid');
        }
      }

      if (purchase_date && product.main_product_purchase_date) {
        if (purchase_date === product.main_product_purchase_date) {
          confidence += 0.3;
          matchedFields.push('purchase_date');
        }
      }

      if (confidence > 0) {
        matches.push({
          id: product.id,
          glide_id: product.glide_id,
          confidence,
          matchType: 'automatic',
          message_id: messageId,
          product_id: product.id,
          details: {
            matchedFields,
            confidence,
          },
        });
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);

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

const logSyncOperation = async (
  client: SupabaseClient<Database>,
  operation: string,
  details: Record<string, any>
) => {
  try {
    await client
      .from('sync_logs')
      .insert({
        operation_type: operation,
        status: 'completed',
        details
      });
  } catch (error) {
    console.error('Error logging sync operation:', error);
  }
};

export { findMatches, logSyncOperation };
