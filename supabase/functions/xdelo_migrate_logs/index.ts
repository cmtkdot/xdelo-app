
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, limit = 1000 } = await req.json();
    
    // Generate a session ID for this operation
    const sessionId = crypto.randomUUID();

    switch (action) {
      case 'migrate_sync_logs': {
        // Fetch records from gl_sync_logs not already in unified_audit_logs
        const { data: syncLogs, error: fetchError } = await supabaseClient
          .from('gl_sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
          
        if (fetchError) throw new Error(`Error fetching sync logs: ${fetchError.message}`);
        
        if (!syncLogs || syncLogs.length === 0) {
          return new Response(
            JSON.stringify({ success: true, message: 'No sync logs to migrate', count: 0 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Transform records to unified_audit_logs format
        const unifiedLogs = syncLogs.map(log => {
          // Map status to event type
          let eventType;
          if (log.operation === 'warning') {
            eventType = 'system_warning';
          } else if (log.status === 'error') {
            eventType = 'processing_error';
          } else {
            eventType = 'processing_completed';
          }
          
          return {
            event_type: eventType,
            entity_id: log.record_id,
            correlation_id: sessionId,
            metadata: {
              legacy_source: 'gl_sync_logs',
              legacy_operation: log.operation,
              legacy_table: log.table_name,
              legacy_status: log.status,
              glide_id: log.glide_id,
              created_at: log.created_at,
              migrated_at: new Date().toISOString()
            },
            error_message: log.error_message,
            event_timestamp: log.created_at
          };
        });
        
        // Insert into unified_audit_logs
        const { error: insertError } = await supabaseClient
          .from('unified_audit_logs')
          .insert(unifiedLogs);
          
        if (insertError) throw new Error(`Error inserting unified logs: ${insertError.message}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Migrated ${unifiedLogs.length} sync logs to unified_audit_logs`,
            count: unifiedLogs.length,
            session_id: sessionId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'analyze_log_usage': {
        // Analyze which components are still using old logging methods
        const { data: recentLogs, error: fetchError } = await supabaseClient
          .from('gl_sync_logs')
          .select('operation, table_name, count(*)')
          .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .group('operation, table_name')
          .order('count', { ascending: false });
          
        if (fetchError) throw new Error(`Error analyzing log usage: ${fetchError.message}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Log usage analysis completed',
            recent_usage: recentLogs,
            period: '7 days'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
