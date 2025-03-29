
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from './utils';
import { logEvent, LogEventType } from '@/lib/logger';

export interface RepairResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  successful?: number;
  failed?: number;
  retryCount?: number;
}

export interface BatchRepairOptions {
  limit?: number;
  repairAll?: boolean;
  messageIds?: string[];
  enableRedownload?: boolean;
  fixPaths?: boolean;
  fixUrls?: boolean;
  fixContentDisposition?: boolean;
}

/**
 * Repair a batch of media messages with various fixes
 */
export async function repairMediaBatch(options: BatchRepairOptions): Promise<RepairResult> {
  try {
    // Generate tracking ID for this operation
    const operationId = crypto.randomUUID();
    
    // Log start of operation
    await logEvent(
      LogEventType.MEDIA_REUPLOAD_REQUESTED, 
      'batch',
      {
        operation_id: operationId,
        options,
        timestamp: new Date().toISOString()
      }
    );
    
    // Call the edge function with retry mechanism
    const { data, error, retryCount } = await withRetry(
      () => supabase.functions.invoke('xdelo_unified_media_repair', {
        body: options
      }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        retryableErrors: ['timeout', 'connection']
      }
    );
    
    if (error) {
      // Log failure
      await logEvent(
        LogEventType.MEDIA_REUPLOAD_FAILED,
        'batch',
        {
          operation_id: operationId,
          error: error.message,
          options,
          retry_count: retryCount
        }
      );
      
      return {
        success: false,
        message: error.message || 'Failed to repair media batch',
        error: error.message,
        retryCount
      };
    }
    
    // Log success
    await logEvent(
      LogEventType.MEDIA_REUPLOAD_SUCCESS,
      'batch',
      {
        operation_id: operationId,
        result: data,
        options,
        retry_count: retryCount
      }
    );
    
    return {
      success: true,
      message: data?.message || 'Successfully repaired media batch',
      successful: data?.successful || 0,
      failed: data?.failed || 0,
      data,
      retryCount
    };
  } catch (error) {
    console.error('Error in repairMediaBatch:', error);
    
    // Log exception
    await logEvent(
      LogEventType.MEDIA_REUPLOAD_FAILED,
      'batch',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        options
      }
    );
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Process caption for a single message, using database RPC
 */
export async function processCaptionRpc(messageId: string, force: boolean = false): Promise<RepairResult> {
  try {
    // Generate correlation ID
    const correlationId = crypto.randomUUID().toString();
    
    // Log the operation start
    await logEvent(
      LogEventType.CAPTION_PARSED,
      messageId,
      {
        force,
        method: 'rpc',
        correlationId
      }
    );
    
    // Call the RPC function with retry
    const { data, error, retryCount } = await withRetry(
      // Here we safely use RPC with our extended client types
      () => supabase.functions.invoke('xdelo_process_caption', {
        body: {
          messageId,
          correlationId,
          force
        }
      }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        retryableErrors: ['timeout', 'connection']
      }
    );
    
    if (error) {
      await logEvent(
        LogEventType.MESSAGE_ERROR,
        messageId,
        {
          error: error.message,
          method: 'rpc',
          correlationId,
          retry_count: retryCount
        }
      );
      
      return {
        success: false,
        message: error.message,
        error: error.message,
        retryCount
      };
    }
    
    await logEvent(
      LogEventType.MESSAGE_PROCESSED,
      messageId,
      {
        result: data,
        method: 'rpc',
        correlationId,
        retry_count: retryCount
      }
    );
    
    return {
      success: true,
      message: 'Caption processed successfully',
      data,
      retryCount
    };
  } catch (error) {
    console.error('Error in processCaptionRpc:', error);
    
    await logEvent(
      LogEventType.MESSAGE_ERROR,
      messageId,
      {
        error: error instanceof Error ? error.message : String(error),
        method: 'exception',
        correlationId: crypto.randomUUID().toString()
      }
    );
    
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
