
import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure the product matching configuration exists
 * This function is called when initializing the ProductMatching page
 */
export const ensureMatchingConfigColumn = async (): Promise<boolean> => {
  try {
    // Call our RPC function to get the configuration
    // This will automatically create a default config if one doesn't exist
    const { data, error } = await supabase.rpc('xdelo_get_product_matching_config');
    
    if (error) {
      console.error("Failed to ensure product matching configuration exists:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error in ensureMatchingConfigColumn:", error);
    return false;
  }
};
