
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
    
    // Otherwise call the Edge function to add the column
    try {
      // First try the dedicated Edge function
      const { data, error } = await supabase.functions.invoke('xdelo_add_matching_config_column');
      
      if (error) {
        console.error("Error calling Edge function:", error);
        
        // Fallback: try the dedicated RPC function if available
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            "xdelo_ensure_matching_config_column"
          );
          
          if (rpcError) {
            console.error("RPC function error:", rpcError);
            
            // Last fallback: use generic SQL migration function
            const { data: sqlData, error: sqlError } = await supabase.rpc(
              "execute_sql_migration" as any,
              { 
                sql_command: `
                  ALTER TABLE IF EXISTS public.settings 
                  ADD COLUMN IF NOT EXISTS matching_config JSONB DEFAULT '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}';
                `
              }
            );
            
            if (sqlError) {
              console.error("SQL migration error:", sqlError);
              return false;
            }
            
            return true;
          }
          
          return true;
        } catch (rpcError) {
          console.error("Error executing RPC function:", rpcError);
          return false;
        }
      }
      
      return true;
    } catch (funcError) {
      console.error("Error calling function to ensure matching config:", funcError);
      return false;
    }
  } catch (error) {
    console.error("Error in ensureMatchingConfigColumn:", error);
    return false;
  }
};
