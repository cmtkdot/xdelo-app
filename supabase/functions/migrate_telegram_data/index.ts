
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/consolidatedMessageUtils.ts";

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create authenticated Supabase client
    const supabase = createSupabaseClient();
    
    // Call the migration function
    const { data, error } = await supabase.rpc('migrate_telegram_data_to_metadata');

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        migrated_count: data.migrated_count || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in migrate telegram data:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
