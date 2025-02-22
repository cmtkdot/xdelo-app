import { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from './logger';

interface AnalysisResult {
  success: boolean;
  error?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error occurred';
}

export async function triggerAnalysis(
  messageId: number,
  correlationId: string,
  supabase: SupabaseClient,
  mediaGroupId?: string
): Promise<AnalysisResult> {
  const logger = getLogger(correlationId);
  
  try {
    logger.info('Triggering analysis', { 
      messageId,
      mediaGroupId,
      correlationId 
    });
    
    // Update message to show processing started
    await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        processing_correlation_id: correlationId
      })
      .eq('telegram_message_id', messageId);
    
    // Invoke analysis function
    await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        messageId,
        correlationId,
        mediaGroupId
      }
    });
    
    return { success: true };
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    
    // Update message with error state
    await supabase
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: errorMessage,
        last_error_at: new Date().toISOString()
      })
      .eq('telegram_message_id', messageId);
    
    logger.error('Failed to trigger analysis', { error: errorMessage });
    return {
      success: false,
      error: errorMessage
    };
  }
} 