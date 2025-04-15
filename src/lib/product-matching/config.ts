
import { supabase } from "@/integrations/supabase/client";
import { ProductMatchingConfig, DEFAULT_CONFIG } from "./types";

/**
 * Fetch the current product matching configuration from Supabase
 */
export async function fetchMatchingConfig(): Promise<ProductMatchingConfig> {
  try {
    const { data, error } = await supabase
      .rpc('xdelo_get_product_matching_config');
    
    if (error) {
      console.error("Error fetching product matching configuration:", error);
      throw error;
    }
    
    if (!data) {
      console.warn("No configuration found, using default");
      return DEFAULT_CONFIG;
    }
    
    return mergeWithDefaults(data as Partial<ProductMatchingConfig>);
  } catch (err) {
    console.error("Error fetching product matching configuration:", err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Update product matching configuration in Supabase
 */
export async function updateMatchingConfig(
  config: Partial<ProductMatchingConfig>
): Promise<ProductMatchingConfig> {
  try {
    // First merge with defaults to ensure all required fields exist
    const mergedConfig = mergeWithDefaults(config);
    
    // Validate the configuration
    validateConfig(mergedConfig);
    
    // For RPC calls, we need to cast to any to avoid type issues
    const configForRpc = mergedConfig as any;
    
    // Update configuration in Supabase
    const { data, error } = await supabase
      .rpc('xdelo_update_product_matching_config', {
        p_config: configForRpc
      });
    
    if (error) {
      console.error("Error updating product matching configuration:", error);
      throw error;
    }
    
    if (!data) {
      console.warn("No data returned from update, using merged config");
      return mergedConfig;
    }
    
    // Cast the data to ProductMatchingConfig
    return data as unknown as ProductMatchingConfig;
  } catch (err) {
    console.error("Error updating product matching configuration:", err);
    throw err;
  }
}

/**
 * Ensure product matching configuration exists in the database
 */
export async function ensureMatchingConfig(): Promise<void> {
  try {
    const { data, error } = await supabase
      .rpc('xdelo_get_product_matching_config');
    
    if (error) {
      console.error("Error checking for product matching configuration:", error);
      throw error;
    }
    
    if (!data) {
      console.log("No product matching configuration found, creating default");
      await updateMatchingConfig(DEFAULT_CONFIG);
    }
  } catch (err) {
    console.error("Failed to ensure product matching configuration exists:", err);
  }
}

/**
 * Validate configuration values
 */
function validateConfig(config: ProductMatchingConfig): void {
  // Check thresholds are between 0 and 1
  if (config.similarityThreshold < 0 || config.similarityThreshold > 1) {
    throw new Error("similarityThreshold must be between 0 and 1");
  }
  
  if (config.minConfidence < 0 || config.minConfidence > 1) {
    throw new Error("minConfidence must be between 0 and 1");
  }
  
  // Check weights sum to 1 (with a small tolerance for floating point errors)
  const weightSum = config.weights.productName + 
                    config.weights.vendorUid + 
                    config.weights.purchaseDate;
  
  if (Math.abs(weightSum - 1) > 0.01) {
    throw new Error(`Weights must sum to 1.0 (current sum: ${weightSum})`);
  }
  
  // Validate individual weights
  if (config.weights.productName < 0 || config.weights.productName > 1) {
    throw new Error("productName weight must be between 0 and 1");
  }
  
  if (config.weights.vendorUid < 0 || config.weights.vendorUid > 1) {
    throw new Error("vendorUid weight must be between 0 and 1");
  }
  
  if (config.weights.purchaseDate < 0 || config.weights.purchaseDate > 1) {
    throw new Error("purchaseDate weight must be between 0 and 1");
  }
}

/**
 * Merge partial config with defaults
 */
function mergeWithDefaults(
  partialConfig: Partial<ProductMatchingConfig>
): ProductMatchingConfig {
  return {
    similarityThreshold: partialConfig.similarityThreshold ?? DEFAULT_CONFIG.similarityThreshold,
    minConfidence: partialConfig.minConfidence ?? DEFAULT_CONFIG.minConfidence,
    
    weights: {
      productName: partialConfig.weights?.productName ?? DEFAULT_CONFIG.weights.productName,
      vendorUid: partialConfig.weights?.vendorUid ?? DEFAULT_CONFIG.weights.vendorUid,
      purchaseDate: partialConfig.weights?.purchaseDate ?? DEFAULT_CONFIG.weights.purchaseDate
    },
    
    partialMatch: {
      enabled: partialConfig.partialMatch?.enabled ?? DEFAULT_CONFIG.partialMatch.enabled,
      vendorMinLength: partialConfig.partialMatch?.vendorMinLength ?? DEFAULT_CONFIG.partialMatch.vendorMinLength,
      dateFormat: partialConfig.partialMatch?.dateFormat ?? DEFAULT_CONFIG.partialMatch.dateFormat
    },
    
    algorithm: {
      useJaroWinkler: partialConfig.algorithm?.useJaroWinkler ?? DEFAULT_CONFIG.algorithm.useJaroWinkler,
      useLevenshtein: partialConfig.algorithm?.useLevenshtein ?? DEFAULT_CONFIG.algorithm.useLevenshtein
    }
  };
}
