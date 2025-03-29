import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/integrations/supabase/types";
import { logEvent, LogEventType } from "@/lib/logUtils";

/**
 * Placeholder for product matching functionality
 * since gl_products has been removed
 */
export const matchProduct = async (messageId: string, supabaseClient: SupabaseClient<Database>) => {
  return {
    success: true,
    matches: [],
    bestMatch: null
  };
};

/**
 * Placeholder for batch matching
 */
export const batchMatchProducts = async (messageIds: string[]) => {
  return {
    success: true,
    results: messageIds.map(id => ({ success: true, matches: [], bestMatch: null })),
    summary: {
      total: messageIds.length,
      matched: 0,
      unmatched: messageIds.length,
      failed: 0
    }
  };
};
