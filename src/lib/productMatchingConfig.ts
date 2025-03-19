
import { supabase } from "@/integrations/supabase/client";
import { ProductMatchingConfig } from "@/types/entities/ProductMatching";

/**
 * Default configuration for product matching algorithm
 */
export const DEFAULT_CONFIG: ProductMatchingConfig = {
  similarityThreshold: 0.7,
  partialMatch: {
    enabled: true,
    minLength: 2
  },
  weightedScoring: {
    name: 0.4,
    vendor: 0.3,
    purchaseDate: 0.3
  }
};

/**
 * Fetch configuration from database
 */
export const fetchMatchingConfig = async (): Promise<ProductMatchingConfig> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('matching_config')
      .single();
    
    if (error || !data || !data.matching_config) {
      console.warn("Could not fetch matching configuration, using defaults", error);
      return DEFAULT_CONFIG;
    }
    
    return data.matching_config as ProductMatchingConfig;
  } catch (err) {
    console.error("Error fetching product matching configuration:", err);
    return DEFAULT_CONFIG;
  }
};

/**
 * Update configuration in the database
 */
export const updateMatchingConfig = async (config: Partial<ProductMatchingConfig>): Promise<ProductMatchingConfig> => {
  try {
    // First get the current config
    const { data: currentData } = await supabase
      .from('settings')
      .select('matching_config')
      .single();
    
    // Merge with current config or default
    const updatedConfig = {
      ...(currentData?.matching_config || DEFAULT_CONFIG),
      ...config
    };
    
    // Update in database
    const { error } = await supabase
      .from('settings')
      .update({ matching_config: updatedConfig })
      .eq('id', currentData?.id || 0);
    
    if (error) {
      console.error("Failed to update matching configuration:", error);
      return updatedConfig;
    }
    
    return updatedConfig;
  } catch (err) {
    console.error("Error updating product matching configuration:", err);
    return { ...DEFAULT_CONFIG, ...config };
  }
};
