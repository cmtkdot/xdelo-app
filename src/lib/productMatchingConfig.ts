
import { supabase } from "@/integrations/supabase/client";
import { ProductMatchingConfig } from "@/types/entities/ProductMatching";

/**
 * Default configuration for product matching algorithm
 */
export const DEFAULT_CONFIG: ProductMatchingConfig = {
  similarityThreshold: 0.7,
  partialMatch: {
    enabled: true,
    minLength: 2,
    dateFormat: "YYYY-MM-DD"
  },
  weightedScoring: {
    name: 0.4,
    vendor: 0.3,
    purchaseDate: 0.3
  }
};

// Export CONFIG for compatibility with existing components
export const CONFIG = DEFAULT_CONFIG;

/**
 * Fetch configuration from database
 */
export const fetchMatchingConfig = async (): Promise<ProductMatchingConfig> => {
  try {
    // Use the new RPC function to get configuration
    const { data, error } = await supabase
      .rpc('xdelo_get_product_matching_config');
    
    if (error) {
      console.warn("Could not fetch matching configuration, using defaults", error);
      return DEFAULT_CONFIG;
    }
    
    return data as ProductMatchingConfig;
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
    // Get current config to merge with updates
    const currentConfig = await fetchMatchingConfig();
    
    // Merge with current config
    const updatedConfig = {
      ...currentConfig,
      ...config,
      partialMatch: {
        ...currentConfig.partialMatch,
        ...(config.partialMatch || {})
      },
      weightedScoring: {
        ...currentConfig.weightedScoring,
        ...(config.weightedScoring || {})
      }
    };
    
    // Use the new RPC function to update configuration
    const { data, error } = await supabase
      .rpc('xdelo_update_product_matching_config', {
        p_config: updatedConfig
      });
    
    if (error) {
      console.error("Failed to update matching configuration:", error);
      return updatedConfig;
    }
    
    return data as ProductMatchingConfig;
  } catch (err) {
    console.error("Error updating product matching configuration:", err);
    return { ...DEFAULT_CONFIG, ...config };
  }
};
