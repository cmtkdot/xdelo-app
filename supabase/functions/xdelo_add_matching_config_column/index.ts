
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const supabase = createSupabaseClient();
    
    // Check if the settings table exists
    const { data: tableExists, error: tableCheckError } = await supabase.rpc('pg_query', {
      query_text: `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'settings'
        );
      `
    });
    
    if (tableCheckError) {
      throw new Error(`Error checking if settings table exists: ${tableCheckError.message}`);
    }
    
    if (!tableExists || !tableExists[0]?.exists) {
      // Create settings table if it doesn't exist
      const { error: createTableError } = await supabase.rpc('pg_query', {
        query_text: `
          CREATE TABLE IF NOT EXISTS public.settings (
            id SERIAL PRIMARY KEY,
            bot_token TEXT,
            webhook_url TEXT,
            matching_config JSONB,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
          );
        `
      });
      
      if (createTableError) {
        throw new Error(`Error creating settings table: ${createTableError.message}`);
      }
    } else {
      // Check if matching_config column exists
      const { data: columnExists, error: columnCheckError } = await supabase.rpc('pg_query', {
        query_text: `
          SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'settings'
            AND column_name = 'matching_config'
          );
        `
      });
      
      if (columnCheckError) {
        throw new Error(`Error checking if matching_config column exists: ${columnCheckError.message}`);
      }
      
      // Add matching_config column if it doesn't exist
      if (!columnExists || !columnExists[0]?.exists) {
        const { error: addColumnError } = await supabase.rpc('pg_query', {
          query_text: `
            ALTER TABLE public.settings
            ADD COLUMN IF NOT EXISTS matching_config JSONB;
          `
        });
        
        if (addColumnError) {
          throw new Error(`Error adding matching_config column: ${addColumnError.message}`);
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Settings table and matching_config column verified"
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error in migration:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
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
