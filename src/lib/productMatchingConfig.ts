
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

// Export CONFIG for compatibility with existing components
export const CONFIG = DEFAULT_CONFIG;

/**
 * Fetch configuration from database
 */
export const fetchMatchingConfig = async (): Promise<ProductMatchingConfig> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('matching_config, product_matching_config')
      .single();
    
    if (error) {
      console.warn("Could not fetch matching configuration, using defaults", error);
      return DEFAULT_CONFIG;
    }
    
    // Try to use matching_config first, if it exists, otherwise fall back to product_matching_config
    if (data && data.matching_config) {
      return data.matching_config as ProductMatchingConfig;
    } else if (data && data.product_matching_config) {
      return data.product_matching_config as ProductMatchingConfig;
    }
    
    return DEFAULT_CONFIG;
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
    const { data: currentData, error: fetchError } = await supabase
      .from('settings')
      .select('id, matching_config, product_matching_config')
      .single();
    
    if (fetchError) {
      console.warn("Could not fetch current config, creating new entry", fetchError);
      // Create a new settings entry with the config
      const { error: insertError } = await supabase
        .from('settings')
        .insert([{ matching_config: { ...DEFAULT_CONFIG, ...config } }]);
      
      if (insertError) {
        console.error("Failed to insert new matching configuration:", insertError);
      }
      
      return { ...DEFAULT_CONFIG, ...config };
    }
    
    // Determine which column to use - prefer matching_config if it exists
    const useMatchingConfig = currentData && 'matching_config' in currentData;
    const currentConfigField = useMatchingConfig ? 'matching_config' : 'product_matching_config';
    const currentConfig = currentData?.[currentConfigField] || DEFAULT_CONFIG;
    
    // Merge with current config or default
    const updatedConfig = {
      ...currentConfig,
      ...config
    };
    
    // Update in database
    const updateData: Record<string, any> = {
      [useMatchingConfig ? 'matching_config' : 'product_matching_config']: updatedConfig
    };
    
    const { error: updateError } = await supabase
      .from('settings')
      .update(updateData)
      .eq('id', currentData?.id || 0);
    
    if (updateError) {
      console.error("Failed to update matching configuration:", updateError);
    }
    
    return updatedConfig;
  } catch (err) {
    console.error("Error updating product matching configuration:", err);
    return { ...DEFAULT_CONFIG, ...config };
  }
};
