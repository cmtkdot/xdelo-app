
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Logger } from './utils/logger.ts';

interface AnalysisResult {
  success: boolean;
  error?: string;
}

export async function triggerAnalysis(
  messageId: string,
  correlationId: string,
  supabase: SupabaseClient,
  logger: Logger
): Promise<AnalysisResult> {
  try {
    logger.info('Triggering analysis', { messageId });
    
    // Update the message status to processing
    await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', messageId);
      
    // Call the parse-caption-with-ai function
    await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        correlation_id: correlationId
      }
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to trigger analysis', { error: error.message });
    
    // Update message to error state
    try {
      await supabase
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: `Failed to trigger analysis: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    } catch (updateError) {
      logger.error('Failed to update message error state', { error: updateError.message });
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}
