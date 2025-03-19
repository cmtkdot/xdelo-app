
import { Logger } from './utils/logger.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createAnalysisTrigger } from './dbOperations.ts';

/**
 * Triggers caption analysis for a message
 */
export async function triggerAnalysis(
  messageId: string,
  correlationId: string,
  supabase: SupabaseClient,
  logger: Logger
): Promise<void> {
  try {
    // Log the analysis trigger
    logger.track(correlationId, `Triggering caption analysis for message ${messageId}`);
    
    // Mark the message as processing
    await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', messageId);
    
    // Create analysis trigger in unified_audit_logs
    await createAnalysisTrigger(messageId, correlationId);
    
    logger.track(correlationId, `Analysis trigger created for message ${messageId}`);
  } catch (error) {
    logger.error(`Failed to trigger analysis for message ${messageId}`, error);
    
    // Update the message to mark the error
    await supabase
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: `Failed to trigger analysis: ${error.message}`,
        last_error_at: new Date().toISOString(),
      })
      .eq('id', messageId);
      
    throw error;
  }
}
