import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database, Tables } from '../types/supabase';
import { logSyncOperation, logSyncOperationBatch, logSyncWarning } from './sync-utils';

// Constants
const CONFIDENCE_THRESHOLDS = {
  AUTO_APPLY: 0.6,
  LOW_CONFIDENCE: 0.75,
  FUZZY_MATCH: 0.6,
  DATE_RANGE_DAYS: 5,
  NAME_MATCH_WEIGHTS: {
    MAIN_PRODUCT_NAME: 1.0,
    MAIN_VENDOR_PRODUCT_NAME: 0.9
  }
} as const;

// Types
interface MatchResult {
  message_id: string;
  product_id: string;
  match_priority: number;
  confidence_score: number;
  match_details: {
    criteria: string[];
    matched_fields: {
      product_name?: string;
      vendor?: string;
      purchase_date?: string;
      po?: string;
      similarity_score: number;
    };
  };
  glide_id?: string | null;
}

// Utility function for string similarity using Levenshtein distance
function calculateStringSimilarity(str1: string | null, str2: string | null): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const matrix = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLength;
}

// Enhanced function to check product name similarity across main name fields
function calculateProductNameSimilarity(messageName: string | null, product: Tables<'gl_products'>): number {
  if (!messageName) return 0;

  const nameMatches = [
    { field: product.main_product_name, weight: CONFIDENCE_THRESHOLDS.NAME_MATCH_WEIGHTS.MAIN_PRODUCT_NAME },
    { field: product.main_vendor_product_name, weight: CONFIDENCE_THRESHOLDS.NAME_MATCH_WEIGHTS.MAIN_VENDOR_PRODUCT_NAME }
  ];

  let bestMatch = 0;
  for (const { field, weight } of nameMatches) {
    if (field) {
      const similarity = calculateStringSimilarity(messageName, field) * weight;
      bestMatch = Math.max(bestMatch, similarity);
    }
  }

  return bestMatch;
}

// Function to check if dates are within range
function areDatesWithinRange(date1: string | null, date2: string | null, days: number = CONFIDENCE_THRESHOLDS.DATE_RANGE_DAYS): boolean {
  if (!date1 || !date2) return false;
  
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
  } catch (error) {
    console.error('Date comparison error:', error);
    return false;
  }
}

// Main matching function with simplified logic
export async function findProductMatches(
  messageId: string,
  supabase: SupabaseClient<Database>
): Promise<MatchResult[]> {
  const startTime = Date.now();
  try {
    // Get message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      await logSyncOperation(
        supabase,
        'product_match',
        {
          entityId: messageId,
          metadata: {
            duration: Date.now() - startTime
          }
        },
        false,
        messageError?.message || 'Message not found'
      );
      throw new Error(messageError?.message || 'Message not found');
    }

    const { data: products, error: productsError } = await supabase
      .from('gl_products')
      .select('*');

    if (productsError || !products) {
      await logSyncOperation(
        supabase,
        'product_match',
        {
          entityId: messageId,
          metadata: {
            duration: Date.now() - startTime
          }
        },
        false,
        productsError?.message || 'Products not found'
      );
      throw new Error(productsError?.message || 'Products not found');
    }

    let bestMatch: MatchResult[] = [];
    let highestConfidence = 0;

    for (const product of products) {
      // Skip if product is marked as renamed but new name not set
      if ((product.cart_rename || product.main_rename_product) && !product.main_new_product_name) {
        continue;
      }

      // Priority 1: Exact PO and product name match (100% confidence)
      if (
        message.purchase_order &&
        product.po_pouid_from_add_prod &&
        message.purchase_order === product.po_pouid_from_add_prod
      ) {
        const productNameSimilarity = calculateProductNameSimilarity(message.product_name, product);
        if (productNameSimilarity > 0.9) { // High similarity threshold for exact match
          const match: MatchResult = {
            message_id: message.id,
            product_id: product.id,
            glide_id: product.glide_id,
            match_priority: 1,
            confidence_score: 1,
            match_details: {
              criteria: ['exact_po', 'exact_product_name'],
              matched_fields: {
                po: message.purchase_order,
                product_name: message.product_name,
                similarity_score: productNameSimilarity
              }
            }
          };
          bestMatch.push(match);
        }
      }

      // Priority 2: Exact product name, vendor, and date range (90% confidence)
      const productNameSimilarity = calculateProductNameSimilarity(message.product_name, product);
      if (
        productNameSimilarity > 0.9 &&
        message.vendor_uid === product.main_vendor_uid &&
        areDatesWithinRange(message.purchase_date, product.main_product_purchase_date)
      ) {
        const match: MatchResult = {
          message_id: message.id,
          product_id: product.id,
          glide_id: product.glide_id,
          match_priority: 2,
          confidence_score: 0.9,
          match_details: {
            criteria: ['exact_product_name', 'exact_vendor', 'date_range'],
            matched_fields: {
              product_name: message.product_name,
              vendor: message.vendor_uid,
              purchase_date: message.purchase_date,
              similarity_score: productNameSimilarity
            }
          }
        };
        if (0.9 > highestConfidence) {
          highestConfidence = 0.9;
          bestMatch = [match];
        } else if (0.9 === highestConfidence) {
          bestMatch.push(match);
        }
      }

      // Priority 3: Exact PO and fuzzy product name (70-80% confidence)
      if (message.purchase_order === product.po_pouid_from_add_prod) {
        const productNameSimilarity = calculateProductNameSimilarity(message.product_name, product);

        if (productNameSimilarity > CONFIDENCE_THRESHOLDS.FUZZY_MATCH) {
          const confidence = 0.7 + (productNameSimilarity - CONFIDENCE_THRESHOLDS.FUZZY_MATCH) * 0.5;
          const match: MatchResult = {
            message_id: message.id,
            product_id: product.id,
            glide_id: product.glide_id,
            match_priority: 3,
            confidence_score: confidence,
            match_details: {
              criteria: ['exact_po', 'fuzzy_product_name'],
              matched_fields: {
                po: message.purchase_order,
                similarity_score: productNameSimilarity
              }
            }
          };
          if (confidence > highestConfidence) {
            highestConfidence = confidence;
            bestMatch = [match];
          } else if (confidence === highestConfidence) {
            bestMatch.push(match);
          }
        }
      }

      // Priority 4: Fuzzy product name, exact vendor, date range (60-75% confidence)
      if (
        productNameSimilarity > CONFIDENCE_THRESHOLDS.FUZZY_MATCH &&
        message.vendor_uid === product.main_vendor_uid &&
        areDatesWithinRange(message.purchase_date, product.main_product_purchase_date)
      ) {
        const confidence = 0.6 + (productNameSimilarity - CONFIDENCE_THRESHOLDS.FUZZY_MATCH) * 0.375;
        const match: MatchResult = {
          message_id: message.id,
          product_id: product.id,
          glide_id: product.glide_id,
          match_priority: 4,
          confidence_score: confidence,
          match_details: {
            criteria: ['fuzzy_product_name', 'exact_vendor', 'date_range'],
            matched_fields: {
              similarity_score: productNameSimilarity,
              vendor: message.vendor_uid,
              purchase_date: message.purchase_date
            }
          }
        };
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = [match];
        } else if (confidence === highestConfidence) {
          bestMatch.push(match);
        }
      }
    }

    // Log successful matches
    await logSyncOperation(
      supabase,
      'product_match',
      {
        entityId: messageId,
        matches: matches.length,
        metadata: {
          duration: Date.now() - startTime,
          matchCount: matches.length
        }
      },
      true
    );

    return bestMatch;
  } catch (error) {
    await logSyncOperation(
      supabase,
      'product_match',
      {
        entityId: messageId,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime
        }
      },
      false,
      error.message
    );
    throw error;
  }
}

// Function to process and apply matches with improved error handling
export async function processAndApplyMatches(
  messageIds: string[],
  supabase: SupabaseClient<Database>
): Promise<void> {
  const startTime = Date.now();
  const batchOperations: Array<{
    operation: 'product_match';
    result: {
      success: boolean;
      entityId: string;
      details?: Record<string, unknown>;
      error?: string;
      metadata: { duration: number };
    };
  }> = [];

  try {
    for (const messageId of messageIds) {
      try {
        const matches = await findProductMatches(messageId, supabase);
        
        if (matches.length === 0) {
          batchOperations.push({
            operation: 'product_match',
            result: {
              success: true,
              entityId: messageId,
              details: { status: 'no_matches_found' },
              metadata: { duration: Date.now() - startTime }
            }
          });
          continue;
        }

        // Process high confidence matches
        const highConfidenceMatches = matches.filter(
          match => match.confidence_score >= CONFIDENCE_THRESHOLDS.AUTO_APPLY
        );

        if (highConfidenceMatches.length > 0) {
          const { error: insertError } = await supabase
            .from('sync_matches')
            .insert(highConfidenceMatches.map(match => ({
              message_id: match.message_id,
              product_id: match.product_id,
              match_priority: match.match_priority,
              confidence_score: match.confidence_score,
              match_details: match.match_details,
              status: 'pending',
              applied: false
            })));

          if (insertError) throw insertError;

          batchOperations.push({
            operation: 'product_match',
            result: {
              success: true,
              entityId: messageId,
              details: {
                matches_applied: highConfidenceMatches.length,
                total_matches: matches.length
              },
              metadata: { duration: Date.now() - startTime }
            }
          });
        } else {
          await logSyncWarning('product_match', 
            'No high confidence matches found',
            { 
              correlationId: messageId,
              duration: Date.now() - startTime
            }
          );
        }
      } catch (error) {
        batchOperations.push({
          operation: 'product_match',
          result: {
            success: false,
            entityId: messageId,
            error: error.message,
            metadata: { duration: Date.now() - startTime }
          }
        });
      }
    }

    // Log all operations in batch
    await logSyncOperationBatch(batchOperations);
  } catch (error) {
    await logSyncOperation(
      supabase,
      'process_matches',
      {
        messageIds,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime
        }
      },
      false,
      error.message
    );
    throw error;
  }
}

// Function to handle bulk reprocessing
export async function reprocessExistingMatches(
  supabase: SupabaseClient<Database>
): Promise<void> {
  const startTime = Date.now();
  try {
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id')
      .is('processed_at', null);

    if (fetchError) {
      await logSyncOperation(
        supabase,
        'reprocess_matches',
        {
          error: fetchError.message,
          metadata: {
            duration: Date.now() - startTime
          }
        },
        false,
        fetchError.message
      );
      throw fetchError;
    }

    if (!messages || messages.length === 0) {
      await logSyncOperation(
        supabase,
        'reprocess_matches',
        {
          details: { status: 'no_messages_to_process' },
          metadata: {
            duration: Date.now() - startTime
          }
        },
        true
      );
      return;
    }

    await processAndApplyMatches(
      messages.map(m => m.id),
      supabase
    );

    await logSyncOperation(
      supabase,
      'reprocess_matches',
      {
        details: {
          messages_processed: messages.length
        },
        metadata: {
          duration: Date.now() - startTime
        }
      },
      true
    );
  } catch (error) {
    await logSyncOperation(
      supabase,
      'reprocess_matches',
      {
        error: error.message,
        metadata: {
          duration: Date.now() - startTime
        }
      },
      false,
      error.message
    );
    throw error;
  }
}
