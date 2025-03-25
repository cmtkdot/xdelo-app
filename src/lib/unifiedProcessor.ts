
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

type UnifiedProcessorOperation = 'process_caption' | 'sync_media_group' | 'reprocess' | 'delayed_sync';

interface ProcessorParams {
  messageId?: string;
  mediaGroupId?: string;
  force?: boolean;
  correlationId?: string;
}

/**
 * Call the unified processor for media operations
 */
export async function callUnifiedProcessor(
  operation: UnifiedProcessorOperation,
  params: ProcessorParams
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  correlationId: string;
}> {
  try {
    // Generate a correlation ID if not provided
    const correlationId = params.correlationId || uuidv4();
    
    console.log(`Calling unified processor: ${operation}`, { 
      ...params, 
      correlationId 
    });
    
    // Call the unified processor edge function
    const { data, error } = await supabase.functions.invoke('xdelo_unified_processor', {
      body: {
        operation,
        messageId: params.messageId,
        mediaGroupId: params.mediaGroupId,
        force: params.force,
        correlationId
      }
    });
    
    if (error) {
      console.error(`Error in unified processor ${operation}:`, error);
      return {
        success: false,
        error: error.message,
        correlationId
      };
    }
    
    return {
      success: true,
      data: data?.data,
      correlationId
    };
  } catch (error) {
    console.error(`Exception in unified processor ${operation}:`, error);
    return {
      success: false,
      error: error.message,
      correlationId: params.correlationId || uuidv4()
    };
  }
}

/**
 * Process message caption through the unified processor
 */
export async function processMessageCaption(
  messageId: string,
  force: boolean = false,
  correlationId?: string
): Promise<any> {
  return callUnifiedProcessor('process_caption', { messageId, force, correlationId });
}

/**
 * Synchronize media group content through the unified processor
 */
export async function syncMediaGroup(
  sourceMessageId: string,
  mediaGroupId: string,
  force: boolean = false,
  correlationId?: string
): Promise<any> {
  return callUnifiedProcessor('sync_media_group', { 
    messageId: sourceMessageId, 
    mediaGroupId, 
    force, 
    correlationId 
  });
}

/**
 * Reprocess a message completely through the unified processor
 */
export async function reprocessMessage(
  messageId: string,
  force: boolean = true,
  correlationId?: string
): Promise<any> {
  return callUnifiedProcessor('reprocess', { messageId, force, correlationId });
}

/**
 * Schedule delayed media group synchronization
 */
export async function scheduleDelayedSync(
  messageId: string,
  mediaGroupId: string,
  correlationId?: string
): Promise<any> {
  return callUnifiedProcessor('delayed_sync', { 
    messageId,
    mediaGroupId, 
    correlationId 
  });
}
