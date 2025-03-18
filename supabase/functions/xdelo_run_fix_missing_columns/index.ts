
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { withErrorHandling } from '../_shared/errorHandler.ts';

// Create Supabase client
const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'X-Client-Info': 'xdelo-edge-function'
        }
      }
    }
  );
};

// Main handler function
const handleFixMissingColumns = async (req: Request, correlationId: string) => {
  const supabase = createSupabaseClient();
  
  try {
    // Execute the SQL function to add missing columns
    const { data, error } = await supabase
      .rpc('xdelo_add_missing_columns_to_other_messages');
    
    if (error) {
      throw error;
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully added missing columns to other_messages table',
        columns_added: data?.columns_added || [],
        data
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Error adding missing columns:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred',
        details: error.details
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

// Use the error handling wrapper for consistent error responses
const handler = withErrorHandling(
  'xdelo_run_fix_missing_columns',
  handleFixMissingColumns
);

// Serve the function
Deno.serve(handler);
