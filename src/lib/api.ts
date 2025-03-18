
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
    const correlationId = crypto.randomUUID();
    
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
      correlationId: crypto.randomUUID()
    };
  }
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
  return invokeFunctionWrapper('analyze-with-ai', {
    messageId,
    caption
  });
}

/**
 * Manually parse a caption
 */
export async function parseCaption(messageId: string, caption?: string, isEdit = false) {
  return invokeFunctionWrapper('parse-caption-with-ai', {
    messageId,
    caption,
    isEdit,
    trigger_source: 'web_ui'
  });
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
