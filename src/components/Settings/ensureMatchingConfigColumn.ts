
import { supabase } from "@/integrations/supabase/client";

export const ensureMatchingConfigColumn = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('xdelo_add_matching_config_column');
    
    if (error) {
      console.error("Error ensuring matching_config column exists:", error);
      return false;
    }
    
    return data?.success || false;
  } catch (error) {
    console.error("Exception ensuring matching_config column exists:", error);
    return false;
  }
};
