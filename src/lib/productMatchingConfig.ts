
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CONFIG } from "@/lib/product-matching/types";

export const fetchMatchingConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('product_matching_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      console.error("Error fetching product matching config:", error);
      return DEFAULT_CONFIG;
    }

    // Convert database format to app format
    const config = data[0];
    return {
      similarityThreshold: config.similarity_threshold || DEFAULT_CONFIG.similarityThreshold,
      minConfidence: config.min_confidence || DEFAULT_CONFIG.minConfidence,
      weights: {
        productName: config.weight_name || DEFAULT_CONFIG.weights.productName,
        vendorUid: config.weight_vendor || DEFAULT_CONFIG.weights.vendorUid,
        purchaseDate: config.weight_purchase_date || DEFAULT_CONFIG.weights.purchaseDate
      },
      partialMatch: {
        enabled: config.partial_match_enabled !== undefined ? config.partial_match_enabled : DEFAULT_CONFIG.partialMatch.enabled,
        vendorMinLength: config.partial_match_min_length || DEFAULT_CONFIG.partialMatch.vendorMinLength,
        dateFormat: config.partial_match_date_format || DEFAULT_CONFIG.partialMatch.dateFormat
      },
      algorithm: DEFAULT_CONFIG.algorithm
    };
  } catch (error) {
    console.error("Error in fetchMatchingConfig:", error);
    return DEFAULT_CONFIG;
  }
};

export const updateMatchingConfig = async (config: any) => {
  try {
    // Convert app format to database format
    const dbConfig = {
      similarity_threshold: config.similarityThreshold,
      min_confidence: config.minConfidence,
      weight_name: config.weights.productName,
      weight_vendor: config.weights.vendorUid,
      weight_purchase_date: config.weights.purchaseDate,
      partial_match_enabled: config.partialMatch.enabled,
      partial_match_min_length: config.partialMatch.vendorMinLength,
      partial_match_date_format: config.partialMatch.dateFormat,
      updated_at: new Date().toISOString()
    };

    // Get existing config if any
    const { data: existingConfig } = await supabase
      .from('product_matching_config')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingConfig && existingConfig.length > 0) {
      // Update existing record
      const { error } = await supabase
        .from('product_matching_config')
        .update(dbConfig)
        .eq('id', existingConfig[0].id);

      if (error) throw error;
    } else {
      // Insert new record
      const { error } = await supabase
        .from('product_matching_config')
        .insert([dbConfig]);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error("Error in updateMatchingConfig:", error);
    throw error;
  }
};
