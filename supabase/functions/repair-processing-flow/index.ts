
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const repairProcessingFlow = async (req: Request, correlationId: string) => {
  try {
    // Parse optional parameters
    const { fix_media_groups = true, fix_stuck_messages = true, fix_orphaned = true } = 
      await req.json().catch(() => ({}));
    
    const repairs = [];
    
    // 1. Fix media group content sync issues
    if (fix_media_groups) {
      const { data: mediaGroupResult, error: mediaGroupError } = await supabase.rpc(
        'xdelo_repair_media_group_syncs'
      );
      
      if (mediaGroupError) throw new Error(`Error repairing media groups: ${mediaGroupError.message}`);
      
      repairs.push({
        type: 'media_groups',
        fixed: mediaGroupResult?.length || 0,
        details: mediaGroupResult
      });
    }
    
    // 2. Fix stuck messages in processing state
    if (fix_stuck_messages) {
      const { data: stuckResult, error: stuckError } = await supabase.rpc(
        'xdelo_reset_stalled_messages'
      );
      
      if (stuckError) throw new Error(`Error resetting stalled messages: ${stuckError.message}`);
      
      repairs.push({
        type: 'stuck_messages',
        fixed: stuckResult?.length || 0,
        details: stuckResult
      });
    }
    
    // 3. Fix orphaned relationships
    if (fix_orphaned) {
      const { data: relationshipResult, error: relationshipError } = await supabase.rpc(
        'xdelo_repair_message_relationships'
      );
      
      if (relationshipError) throw new Error(`Error repairing relationships: ${relationshipError.message}`);
      
      repairs.push({
        type: 'relationships',
        fixed: relationshipResult?.length || 0,
        details: relationshipResult
      });
    }
    
    // 4. Run diagnostics
    const { data: diagnosticsResult, error: diagnosticsError } = await supabase.rpc(
      'xdelo_diagnose_queue_issues'
    );
    
    if (diagnosticsError) throw new Error(`Error running diagnostics: ${diagnosticsError.message}`);
    
    // Log the repair operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'system_repair_performed',
      correlation_id: correlationId,
      metadata: {
        repairs,
        diagnostics: diagnosticsResult
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        repairs,
        diagnostics: diagnosticsResult,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in repair flow:', error);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'system_repair_error',
      error_message: error.message,
      correlation_id: correlationId,
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(withErrorHandling('repair-processing-flow', repairProcessingFlow));
