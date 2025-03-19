
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";

interface ResponseData {
  success: boolean;
  message?: string;
  error?: string;
}

// Main handler for the function
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Execute the function
    const result = await ensureMatchingConfig();

    // Return the result
    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: result.success ? 200 : 400
      }
    );
  } catch (error) {
    console.error("Error in add matching config column function:", error);
    
    const errorResponse: ResponseData = {
      success: false,
      error: error.message,
      message: "Failed to add matching_config column to settings table"
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      }
    );
  }
});

/**
 * Ensures that the matching_config column exists in the settings table
 */
async function ensureMatchingConfig(): Promise<ResponseData> {
  try {
    // Check if the settings table has a matching_config column
    const { data: tableInfo, error: infoError } = await supabaseClient
      .from('settings')
      .select('*')
      .limit(1);
    
    if (infoError) {
      return { 
        success: false, 
        error: infoError.message,
        message: "Error checking settings table"
      };
    }
    
    // If the table already has the column, we don't need to create it
    if (tableInfo && tableInfo.length > 0 && 'matching_config' in tableInfo[0]) {
      return { 
        success: true, 
        message: "matching_config column already exists"
      };
    }
    
    // Add the matching_config column to the settings table
    const { error } = await supabaseClient.rpc('xdelo_execute_sql_migration', {
      sql_command: `
        ALTER TABLE IF EXISTS public.settings 
        ADD COLUMN IF NOT EXISTS matching_config JSONB DEFAULT '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}';
      `
    });
    
    if (error) {
      return { 
        success: false, 
        error: error.message,
        message: "Error adding matching_config column"
      };
    }
    
    return { 
      success: true, 
      message: "Added matching_config column to settings table"
    };
  } catch (error) {
    console.error("Error in ensureMatchingConfig:", error);
    return { 
      success: false, 
      error: error.message,
      message: "Exception when adding matching_config column"
    };
  }
}
