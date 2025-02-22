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
    
    await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        correlation_id: correlationId,
        media_group_id: mediaGroupId
      }
    });
    
    return { success: true };
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    
    logger.error('Failed to trigger analysis', { error: errorMessage });
    return {
      success: false,
      error: errorMessage
    };
  }
} 