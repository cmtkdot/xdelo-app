import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventLogCleanupRequest {
  olderThan?: string; // ISO date string
  webhookId?: string;
  status?: string;
  limit?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { olderThan, webhookId, status, limit } = await req.json() as EventLogCleanupRequest;
    
    let query = supabase
      .from("make_event_logs")
      .delete();
    
    // Add filters if provided
    if (olderThan) {
      query = query.lt("created_at", olderThan);
    }
    
    if (webhookId) {
      query = query.eq("webhook_id", webhookId);
    }
    
    if (status) {
      query = query.eq("status", status);
    }
    
    // Add limit if provided
    if (limit) {
      // For limiting with delete, we need to use in() with a subquery
      // First, get the IDs of records to delete
      let idsQuery = supabase
        .from("make_event_logs")
        .select("id");
      
      if (olderThan) {
        idsQuery = idsQuery.lt("created_at", olderThan);
      }
      
      if (webhookId) {
        idsQuery = idsQuery.eq("webhook_id", webhookId);
      }
      
      if (status) {
        idsQuery = idsQuery.eq("status", status);
      }
      
      idsQuery = idsQuery.order("created_at", { ascending: true }).limit(limit);
      
      const { data: idsToDelete, error: idsError } = await idsQuery;
      
      if (idsError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch IDs to delete: ${idsError.message}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      if (idsToDelete.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No records match the criteria", deletedCount: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Then delete the records with those IDs
      const { error: deleteError } = await supabase
        .from("make_event_logs")
        .delete()
        .in("id", idsToDelete.map(record => record.id));
      
      if (deleteError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to delete records: ${deleteError.message}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Deleted ${idsToDelete.length} event logs`,
          deletedCount: idsToDelete.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // If no limit is provided, delete all matching records
    const { error: deleteError } = await query;
    
    if (deleteError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to delete records: ${deleteError.message}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    
    // Get the count of affected rows (this is a bit tricky with Supabase as it doesn't return count for delete)
    // For now, we'll just return success without a count
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully deleted event logs matching criteria"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error clearing event logs:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
}); 