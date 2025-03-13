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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const action = requestData.action;
    
    if (!action) {
      return new Response(
        JSON.stringify({ success: false, error: "Action parameter is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Route to different handlers based on the action parameter
    switch (action) {
      case "create":
        return await createRule(requestData);
      case "update":
        return await updateRule(requestData);
      case "delete":
        return await deleteRule(requestData);
      case "list":
        return await listRules(requestData);
      case "get":
        return await getRule(requestData);
      case "toggle":
        return await toggleRule(requestData);
      case "reorder":
        return await reorderRules(requestData);
      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (error) {
    console.error("Error handling automation rule request:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function createRule(data) {
  const { name, description, event_type, conditions, actions, is_active = true, priority = 0 } = data;
  
  if (!name || !event_type || !conditions || !actions) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing required fields" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  
  const { data: rule, error } = await supabase
    .from("make_automation_rules")
    .insert({
      name,
      description,
      event_type,
      conditions,
      actions,
      is_active,
      priority
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return new Response(
    JSON.stringify({ success: true, rule }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function updateRule(data) {
  const { id, name, description, event_type, conditions, actions, is_active, priority } = data;
  
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (event_type !== undefined) updates.event_type = event_type;
  if (conditions !== undefined) updates.conditions = conditions;
  if (actions !== undefined) updates.actions = actions;
  if (is_active !== undefined) updates.is_active = is_active;
  if (priority !== undefined) updates.priority = priority;
  updates.updated_at = new Date().toISOString();
  
  const { data: rule, error } = await supabase
    .from("make_automation_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  
  return new Response(
    JSON.stringify({ success: true, rule }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function deleteRule(data) {
  const { id } = data;
  
  const { error } = await supabase
    .from("make_automation_rules")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function listRules(data) {
  const { event_type, is_active } = data;
  
  let query = supabase
    .from("make_automation_rules")
    .select("*")
    .order("priority", { ascending: false });
  
  if (event_type) {
    query = query.eq("event_type", event_type);
  }
  
  if (is_active !== undefined) {
    query = query.eq("is_active", is_active);
  }
  
  const { data: rules, error } = await query;
  
  if (error) throw error;
  
  return new Response(
    JSON.stringify({ success: true, rules }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function getRule(data) {
  const { id } = data;
  
  const { data: rule, error } = await supabase
    .from("make_automation_rules")
    .select("*")
    .eq("id", id)
    .single();
  
  if (error) throw error;
  
  return new Response(
    JSON.stringify({ success: true, rule }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function toggleRule(data) {
  const { id, is_active } = data;
  
  const { data: rule, error } = await supabase
    .from("make_automation_rules")
    .update({
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select()
    .single();
  
  if (error) throw error;
  
  return new Response(
    JSON.stringify({ success: true, rule }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function reorderRules(data) {
  const { rules } = data;
  
  if (!Array.isArray(rules)) {
    return new Response(
      JSON.stringify({ success: false, error: "Rules must be an array" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
  
  const updates = rules.map(({ id, priority }) => {
    return supabase
      .from("make_automation_rules")
      .update({ priority, updated_at: new Date().toISOString() })
      .eq("id", id);
  });
  
  await Promise.all(updates);
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
} 