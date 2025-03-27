
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get the request body
  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case "reset_stalled_messages":
        return await resetStalledMessages();
      case "recheck_media_groups":
        return await recheckMediaGroups();
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error(`Error in utility-functions (${action}):`, error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function resetStalledMessages() {
  try {
    // Call the database function to reset stalled messages
    const { data, error } = await supabase.rpc("xdelo_reset_stalled_messages");

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully reset stalled messages",
        data
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error resetting stalled messages:", error);
    throw error;
  }
}

async function recheckMediaGroups() {
  try {
    // Call the database function to recheck media groups
    const { data, error } = await supabase.rpc("xdelo_recheck_media_groups");

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully rechecked media groups",
        data
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error rechecking media groups:", error);
    throw error;
  }
}
