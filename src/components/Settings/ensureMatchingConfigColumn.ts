
import { supabase } from "@/integrations/supabase/client";

/**
 * Ensure the matching_config column exists in the settings table
 * This function is called when initializing the ProductMatching page
 */
export const ensureMatchingConfigColumn = async (): Promise<boolean> => {
  try {
    // Directly execute SQL to ensure the column exists
    const { error } = await supabase.rpc(
      "execute_sql_migration",
      { 
        sql_command: `
          ALTER TABLE IF EXISTS public.settings 
          ADD COLUMN IF NOT EXISTS matching_config JSONB DEFAULT '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}';
          
          -- Create a temporary function to ensure at least one record exists
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM settings LIMIT 1) THEN
              INSERT INTO settings (matching_config) 
              VALUES ('{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}');
            END IF;
          END $$;
        `
      }
    );
    
    if (error) {
      console.error("Failed to ensure matching_config column exists:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error in ensureMatchingConfigColumn:", error);
    return false;
  }
};
