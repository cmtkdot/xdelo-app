
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
    const correlationId = crypto.randomUUID();
    
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
      correlationId: crypto.randomUUID()
    };
  }
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
