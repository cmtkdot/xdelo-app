
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Migration stats type
interface MigrationStats {
  total_logs_migrated: number;
  success_count: number;
  error_count: number;
  skipped_count: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  migration_by_log_type: Record<string, number>;
}

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

    const { limit = 100, batch_size = 20 } = await req.json();
    
    // Initialize migration stats
    const stats: MigrationStats = {
      total_logs_migrated: 0,
      success_count: 0,
      error_count: 0,
      skipped_count: 0,
      start_time: new Date().toISOString(),
      end_time: "",
      duration_ms: 0,
      migration_by_log_type: {}
    };
    
    const startTime = performance.now();
    
    // First check if we have logs to migrate from gl_sync_logs
    const { data: syncLogs, error: syncLogsError } = await supabaseClient
      .from('gl_sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (syncLogsError) {
      throw new Error(`Error fetching sync logs: ${syncLogsError.message}`);
    }
    
    // Process logs in batches
    for (let i = 0; i < syncLogs.length; i += batch_size) {
      const batch = syncLogs.slice(i, i + batch_size);
      
      // Transform the batch to the unified_audit_logs format
      const unifiedLogs = batch.map(log => {
        // Map operation type to event_type
        let eventType;
        switch (log.operation) {
          case 'sync':
          case 'media_group':
            eventType = 'media_group_synced';
            break;
          case 'caption':
            eventType = 'caption_synced';
            break;
          case 'error':
            eventType = 'processing_error';
            break;
          case 'warning':
            eventType = 'system_warning';
            break;
          default:
            eventType = 'system_info';
        }
        
        // Count by type for stats
        stats.migration_by_log_type[eventType] = (stats.migration_by_log_type[eventType] || 0) + 1;
        
        // Create unified log entry
        return {
          event_type: eventType,
          entity_id: log.record_id || 'system',
          metadata: {
            table_name: log.table_name,
            glide_id: log.glide_id,
            migrated_from: 'gl_sync_logs',
            original_operation: log.operation,
            original_status: log.status,
            original_id: log.id,
            migration_timestamp: new Date().toISOString()
          },
          error_message: log.error_message,
          correlation_id: `migration_${crypto.randomUUID()}`,
          event_timestamp: log.created_at
        };
      });
      
      // Insert the batch into unified_audit_logs
      const { data, error } = await supabaseClient
        .from('unified_audit_logs')
        .insert(unifiedLogs);
      
      if (error) {
        console.error('Error migrating logs batch:', error);
        stats.error_count += batch.length;
      } else {
        stats.success_count += batch.length;
        console.log(`Migrated batch ${i/batch_size + 1}, size: ${batch.length}`);
      }
    }
    
    // Update final stats
    stats.total_logs_migrated = syncLogs.length;
    stats.end_time = new Date().toISOString();
    stats.duration_ms = Math.round(performance.now() - startTime);
    
    // Log the migration as a system event
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'system_info',
        entity_id: 'system',
        metadata: {
          action: 'log_migration',
          stats: stats,
          timestamp: new Date().toISOString()
        },
        correlation_id: `migration_summary_${crypto.randomUUID()}`,
        event_timestamp: new Date().toISOString()
      });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        stats: stats 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error during log migration:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
