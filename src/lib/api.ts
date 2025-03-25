
import { supabase } from "@/integrations/supabase/client";

/**
 * Type for API responses
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}

/**
 * Execute a function call with error handling and consistent response format
 */
async function invokeFunctionWrapper<T = any>(
  functionName: string, 
  payload: any, 
  options?: {
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
  }
): Promise<ApiResponse<T>> {
  try {
    // Generate a correlation ID for tracking
    const correlationId = crypto.randomUUID().toString();
    
    // Set up the request
    const { data, error } = await supabase.functions.invoke(functionName, {
      method: options?.method || 'POST',
      body: payload,
      headers: {
        'X-Correlation-ID': correlationId,
        ...options?.headers
      }
    });
    
    if (error) {
      console.error(`Error invoking ${functionName}:`, error);
      return { 
        success: false, 
        error: error.message || `Error calling ${functionName}`,
        correlationId
      };
    }
    
    return { 
      success: true, 
      data: data as T,
      correlationId
    };
  } catch (error: any) {
    console.error(`Exception invoking ${functionName}:`, error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred",
      correlationId: crypto.randomUUID().toString()
    };
  }
}

/**
 * Get Telegram webhook information
 */
export async function getTelegramWebhookInfo(token: string) {
  return invokeFunctionWrapper('xdelo_get-telegram-webhook-info', { token });
}

/**
 * Set Telegram webhook
 */
export async function setTelegramWebhook(token: string) {
  return invokeFunctionWrapper('xdelo_set-telegram-webhook', { token });
}

/**
 * Redownload a file from its media group
 */
export async function redownloadMediaFile(messageId: string, mediaGroupId?: string) {
  return invokeFunctionWrapper('redownload-from-media-group', { 
    messageId,
    mediaGroupId
  });
}

/**
 * Log an operation to the unified audit system
 */
export async function logOperation(
  eventType: string,
  entityId: string,
  metadata: Record<string, any> = {}
) {
  return invokeFunctionWrapper('log-operation', {
    eventType,
    entityId,
    metadata
  });
}

/**
 * Process a message caption with AI
 */
export async function analyzeWithAI(messageId: string, caption: string) {
  try {
    // Generate a correlation ID
    const correlationId = crypto.randomUUID().toString();
    
    // Call the database function directly
    const { data, error } = await supabase.rpc('xdelo_process_caption_workflow', {
      p_message_id: messageId,
      p_correlation_id: correlationId,
      p_force: true
    });
    
    if (error) {
      console.error('Error invoking xdelo_process_caption_workflow:', error);
      return { 
        success: false, 
        error: error.message || 'Error processing caption',
        correlationId
      };
    }
    
    return { 
      success: true, 
      data,
      correlationId
    };
  } catch (error: any) {
    console.error('Exception in analyzeWithAI:', error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred",
      correlationId: crypto.randomUUID().toString()
    };
  }
}

/**
 * Manually parse a caption
 */
export async function parseCaption(messageId: string, caption?: string, isEdit = false) {
  try {
    // Generate a correlation ID
    const correlationId = crypto.randomUUID().toString();
    
    // Call the database function directly instead of the edge function
    const { data, error } = await supabase.rpc('xdelo_process_caption_workflow', {
      p_message_id: messageId,
      p_correlation_id: correlationId,
      p_force: true
    });
    
    if (error) {
      console.error('Error invoking xdelo_process_caption_workflow:', error);
      return { 
        success: false, 
        error: error.message || 'Error processing caption',
        correlationId
      };
    }
    
    return { 
      success: true, 
      data,
      correlationId
    };
  } catch (error: any) {
    console.error('Exception in parseCaption:', error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred",
      correlationId: crypto.randomUUID().toString()
    };
  }
}

/**
 * Delete a message and its associated media files
 */
export async function deleteMessage(messageId: string, cascade = true) {
  return invokeFunctionWrapper('cleanup-storage-on-delete', {
    message_id: messageId,
    cascade
  });
}

/**
 * Validate storage files
 */
export async function validateStorageFiles(options: {
  messageIds?: string[];
  limit?: number;
  fixMissingFiles?: boolean;
}) {
  return invokeFunctionWrapper('validate-storage-files', options);
}
