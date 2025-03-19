
import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure the matching_config column exists in the settings table
 * This function is called when initializing the ProductMatching page
 */
export const ensureMatchingConfigColumn = async (): Promise<boolean> => {
  try {
    // Call the RPC function which ensures the matching_config column exists
    const { data, error } = await supabase.rpc('xdelo_ensure_matching_config');
    
    if (error) {
      console.error("Error ensuring matching config:", error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error("Error in ensureMatchingConfigColumn:", error);
    return false;
  }
};
