import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { xdelo_logMessageOperation, MessageOperationType } from '../../_shared/messageLogger.ts';

type OperationType = 'edit' | 'skip' | 'duplicate' | 'reupload' | 'success' | 'error' | 'info';

interface LogMetadata {
  message?: string;
  error?: string;
  telegram_message_id?: number;
  chat_id?: number;
  file_unique_id?: string;
  sourceMessageId?: string;
  targetMessageId?: string;
  [key: string]: any;
}

export const logMessageOperation = async (
  operation: OperationType,
  correlationId: string,
  metadata: LogMetadata
) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Add timestamp to metadata if not present
    const logMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString()
    };

    // Always log to console for debugging
    console.log(`[${operation.toUpperCase()}] ${metadata.message || ''}`);
    if (metadata.error) {
      console.error(`Error details: ${metadata.error}`);
    }

    // If sourceMessageId is available, use the new logging function
    if (metadata.sourceMessageId) {
      // Map the operation to MessageOperationType
      let operationType: MessageOperationType = 'message_update';
      switch (operation) {
        case 'edit':
          operationType = metadata.edit_type === 'caption_changed' 
            ? 'caption_change' 
            : (metadata.edit_type === 'media_changed' ? 'media_change' : 'message_edit');
          break;
        case 'duplicate':
          operationType = 'message_update';
          break;
        case 'reupload':
          operationType = 'media_redownload';
          break;
        case 'success':
          operationType = metadata.action === 'redownload_completed' 
            ? 'media_redownload' 
            : 'message_update';
          break;
        case 'error':
          // Keep as message_update but include error
          break;
        case 'info':
          operationType = 'message_update';
          break;
      }

      // Use new logging function with source/target message IDs
      await xdelo_logMessageOperation({
        sourceMessageId: metadata.sourceMessageId,
        targetMessageId: metadata.targetMessageId,
        operationType,
        correlationId,
        telegramMessageId: metadata.telegram_message_id,
        chatId: metadata.chat_id,
        metadata: logMetadata,
        errorMessage: metadata.error
      });
    }

    // Attempt to write to the database using legacy method as fallback
    // This ensures backward compatibility
    try {
      await supabase.from('unified_audit_logs').insert({
        event_type: `telegram_webhook_${operation}`,
        correlation_id: correlationId,
        metadata: logMetadata
      });
    } catch (dbError) {
      // Just log it to console and continue, don't throw
      console.error('Failed to write to audit logs:', dbError);
    }
  } catch (error) {
    // Fail silently but log to console
    console.error('Error in logMessageOperation:', error);
  }
};

// Helper to create a logger with a correlation ID
export const getLogger = (correlationId: string) => {
  return {
    info: (message: string, metadata: Record<string, any> = {}) => {
      logMessageOperation('info', correlationId, { message, ...metadata });
    },
    error: (message: string, error: any = null) => {
      logMessageOperation('error', correlationId, { message, error: error?.message || JSON.stringify(error) });
    },
    success: (message: string, metadata: Record<string, any> = {}) => {
      logMessageOperation('success', correlationId, { message, ...metadata });
    }
  };
};
