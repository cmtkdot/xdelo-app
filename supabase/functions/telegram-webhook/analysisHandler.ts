
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
    logger.info('Triggering caption analysis', { 
      messageId,
      timestamp: new Date().toISOString()
    });
    
    // Update the message status to processing
    logger.debug('Updating message status to processing', { messageId });
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', messageId);
      
    if (updateError) {
      logger.error('Failed to update message status', {
        error: updateError.message,
        messageId
      });
      throw new Error(`Failed to update message status: ${updateError.message}`);
    }
    
    // Call the parse-caption-with-ai function
    logger.info('Invoking parse-caption-with-ai function', { messageId });
    const { data, error } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        correlation_id: correlationId
      }
    });
    
    if (error) {
      logger.error('Error invoking parse-caption-with-ai', {
        error: error.message,
        messageId
      });
      throw error;
    }
    
    logger.info('Successfully triggered caption analysis', {
      messageId,
      functionResponse: data
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to trigger analysis', { 
      error: error.message,
      stack: error.stack,
      messageId
    });
    
    // Update message to error state
    try {
      logger.debug('Updating message to error state', { messageId });
      await supabase
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: `Failed to trigger analysis: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    } catch (updateError) {
      logger.error('Failed to update message error state', { 
        error: updateError.message,
        messageId 
      });
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}
