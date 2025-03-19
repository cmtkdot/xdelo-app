import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure the matching_config column exists in the settings table
 * This function is called when initializing the ProductMatching page
 */
export const ensureMatchingConfigColumn = async (): Promise<boolean> => {
  try {
    // Check if the settings table has a matching_config column
    const { data: tableInfo, error: infoError } = await supabase
      .from('settings')
      .select('*')
      .limit(1);
    
    if (infoError) {
      console.error("Error checking settings table:", infoError);
      return false;
    }
    
    // If the table already has the column, we don't need to create it
    if (tableInfo && tableInfo.length > 0 && 'matching_config' in tableInfo[0]) {
      return true;
    }
    
    // Otherwise call the custom function to add the column
    const { data, error } = await supabase.functions.invoke('xdelo_add_matching_config_column');
    
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
