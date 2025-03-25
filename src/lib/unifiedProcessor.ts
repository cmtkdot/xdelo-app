
import { supabase } from '@/integrations/supabase/client';

type ProcessorOperation = 'process_caption' | 'sync_media_group' | 'reprocess' | 'delayed_sync';

interface ProcessorOptions {
  messageId: string;
  mediaGroupId?: string;
  force?: boolean;
  correlationId?: string;
}

/**
 * Calls the unified processor edge function to handle various message operations
 */
export async function callUnifiedProcessor(
  operation: ProcessorOperation,
  options: ProcessorOptions
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}> {
  try {
    console.log(`Calling unified processor with operation: ${operation}`, options);
    
    // Generate correlation ID if not provided
    const correlationId = options.correlationId || crypto.randomUUID().toString();
    
    // Call the edge function
    const { data, error } = await supabase.functions.invoke('xdelo_unified_processor', {
      body: {
        operation,
        messageId: options.messageId,
        mediaGroupId: options.mediaGroupId,
        force: options.force || false,
        correlationId
      }
    });
    
    if (error) {
      console.error(`Error calling unified processor with operation ${operation}:`, error);
      return {
        success: false,
        error: error.message,
        message: `Failed to process operation: ${operation}`
      };
    }
    
    return {
      success: true,
      message: data.message || `Operation ${operation} completed successfully`,
      data
    };
  } catch (error: any) {
    console.error(`Exception calling unified processor with operation ${operation}:`, error);
    return {
      success: false,
      error: error.message,
      message: `Exception during operation: ${operation}`
    };
  }
}

/**
 * Process a message caption
 */
export async function processMessageCaption(
  messageId: string,
  force: boolean = false
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}> {
  return callUnifiedProcessor('process_caption', {
    messageId,
    force
  });
}

/**
 * Sync a media group
 */
export async function syncMediaGroup(
  sourceMessageId: string,
  mediaGroupId: string,
  force: boolean = false
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}> {
  return callUnifiedProcessor('sync_media_group', {
    messageId: sourceMessageId,
    mediaGroupId,
    force
  });
}

/**
 * Process a delayed media group sync
 * (for cases where a group is initially received without caption)
 */
export async function processDelayedMediaGroupSync(
  mediaGroupId: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}> {
  // For delayed sync, we pass the media group ID as both parameters
  // since we'll find the appropriate source message in the function
  return callUnifiedProcessor('delayed_sync', {
    messageId: 'auto-find', // This will be ignored in the function
    mediaGroupId
  });
}

/**
 * Reprocess a message completely
 */
export async function reprocessMessage(
  messageId: string,
  force: boolean = true
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}> {
  return callUnifiedProcessor('reprocess', {
    messageId,
    force
  });
}
