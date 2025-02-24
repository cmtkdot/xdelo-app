import { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from './logger';

interface AnalysisResult {
  success: boolean;
  error?: string;
}

export async function triggerAnalysis(
  messageId: number,
  correlationId: string,
  supabase: SupabaseClient
): Promise<AnalysisResult> {
  const logger = getLogger(correlationId);
  
  try {
    logger.info('Triggering analysis', { messageId });
    
    await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        correlation_id: correlationId
      }
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to trigger analysis', { error });
    return {
      success: false,
      error: error.message
    };
  }
} 