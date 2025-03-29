
import { supabase } from '@/integrations/supabase/client';

/**
 * Safe wrapper for RPC calls that handles type checking
 * and provides better error messages
 */
export async function safeRpcCall<T>(
  functionName: string,
  params: Record<string, any> = {},
  options: {
    maxRetries?: number;
    shouldRetry?: (error: any) => boolean;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<{ success: boolean; data?: T; error?: any; retryCount?: number }> {
  const { maxRetries = 3, shouldRetry, onRetry } = options;
  let retryCount = 0;
  let lastError: any = null;

  // Function to attempt the RPC call
  const attempt = async (): Promise<{ success: boolean; data?: T; error?: any; retryCount?: number }> => {
    try {
      // Try to cast to known function name, otherwise use fallback approach
      // @ts-ignore - We're intentionally bypassing TS here to allow dynamic function calls
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) {
        throw error;
      }
      
      return { success: true, data: data as T };
    } catch (error: any) {
      console.error(`RPC error in ${functionName}:`, error);
      
      // Record the error
      lastError = error;
      retryCount++;
      
      // If retry callback provided, call it
      if (onRetry) {
        onRetry(retryCount, error);
      }
      
      // Should we retry?
      const shouldRetryThis = shouldRetry ? shouldRetry(error) : defaultShouldRetry(error);
      
      if (shouldRetryThis && retryCount < maxRetries) {
        // Exponential backoff with jitter
        const baseDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
        const jitter = Math.random() * 0.3 * baseDelay;
        const delay = baseDelay + jitter;
        
        console.log(`Retrying RPC call to ${functionName} (attempt ${retryCount}/${maxRetries}) after ${Math.round(delay)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try again
        return attempt();
      }
      
      // Max retries reached or not retryable
      return { 
        success: false, 
        error: lastError, 
        retryCount
      };
    }
  };
  
  return attempt();
}

// Default function to determine if an error is retryable
function defaultShouldRetry(error: any): boolean {
  // Network/timeout errors are retryable
  if (error.code === 'ETIMEDOUT' || 
      error.code === 'ECONNRESET' || 
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('timeout') ||
      error.message?.includes('network') ||
      error.message?.includes('connection')) {
    return true;
  }
  
  // Rate limiting errors
  if (error.code === '429' || 
      error.status === 429 ||
      error.statusCode === 429 ||
      error.message?.includes('rate limit')) {
    return true;
  }
  
  // Server errors (5xx)
  if (error.status >= 500 || error.statusCode >= 500) {
    return true;
  }
  
  // Default to not retry
  return false;
}

// Export a simplified utility for the most common case 
export async function callRpc<T>(
  functionName: string,
  params: Record<string, any> = {}
): Promise<T | null> {
  const result = await safeRpcCall<T>(functionName, params);
  return result.success ? (result.data as T) : null;
}

// Create a type-safe utility for handling custom RPC functions
interface CustomRpcFunctions {
  [key: string]: boolean;
}

// Register all custom RPC functions that aren't in the type definition
export const customRpcFunctions: CustomRpcFunctions = {
  'xdelo_process_caption_workflow': true,
  'xdelo_get_product_matching_config': true,
  'xdelo_update_product_matching_config': true,
  'xdelo_fix_audit_log_uuids': true,
  'xdelo_kill_long_queries': true,
  'xdelo_execute_sql_migration': true,
  'xdelo_logprocessingevent': true,
  'gl_products': true
};

/**
 * Enhanced RPC caller that supports both standard and custom functions
 */
export async function callCustomRpc<T>(
  functionName: string,
  params: Record<string, any> = {}
): Promise<T | null> {
  // Use the dynamic approach to bypass TypeScript restrictions
  try {
    // @ts-ignore - Intentional bypass
    const { data, error } = await supabase.rpc(functionName, params);
    
    if (error) {
      console.error(`Error calling custom RPC function ${functionName}:`, error);
      return null;
    }
    
    return data as T;
  } catch (err) {
    console.error(`Exception in custom RPC call to ${functionName}:`, err);
    return null;
  }
}
