// Standardized Supabase client for Telegram Webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Default options for the Supabase client
const defaultOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      'X-Client-Info': 'telegram-webhook',
    },
  },
};

/**
 * Create a Supabase client with default options
 */
export function createSupabaseClient(options = {}): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment');
    throw new Error('Configuration error: Missing Supabase credentials');
  }
  
  return createClient(
    supabaseUrl,
    supabaseKey,
    {
      ...defaultOptions,
      ...options
    }
  );
}

// Singleton instance of the Supabase client
export const supabaseClient = createSupabaseClient();

/**
 * Helper to handle Supabase query errors consistently
 */
export function handleSupabaseError(error: any, operation: string): never {
  console.error(`Supabase ${operation} error:`, error);
  
  // Enhance the error with operation information
  const enhancedError = new Error(
    `Error during ${operation}: ${error.message || 'Unknown error'}`
  );
  
  // Add additional properties to the error
  (enhancedError as any).code = error.code;
  (enhancedError as any).details = error.details;
  (enhancedError as any).hint = error.hint;
  (enhancedError as any).operation = operation;
  
  throw enhancedError;
}

/**
 * Type-safe wrapper for common database operations
 */
export async function executeQuery<T = any>(
  operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc',
  table: string,
  options: Record<string, any> = {},
  errorMessage = 'Database operation failed'
): Promise<T> {
  try {
    let query;
    
    switch (operation) {
      case 'select':
        query = supabaseClient.from(table).select(options.columns || '*');
        break;
      case 'insert':
        query = supabaseClient.from(table).insert(options.data || {});
        break;
      case 'update':
        query = supabaseClient.from(table).update(options.data || {});
        break;
      case 'delete':
        query = supabaseClient.from(table).delete();
        break;
      case 'rpc':
        return await supabaseClient.rpc(table, options.params || {});
      default:
        throw new Error(`Invalid operation: ${operation}`);
    }
    
    // Apply filters if provided
    if (options.filters) {
      options.filters.forEach((filter: any) => {
        const { type, column, value } = filter;
        if (type === 'eq') query = query.eq(column, value);
        else if (type === 'neq') query = query.neq(column, value);
        else if (type === 'gt') query = query.gt(column, value);
        else if (type === 'lt') query = query.lt(column, value);
        else if (type === 'gte') query = query.gte(column, value);
        else if (type === 'lte') query = query.lte(column, value);
        else if (type === 'in') query = query.in(column, value);
        else if (type === 'is') query = query.is(column, value);
        else if (type === 'like') query = query.like(column, value);
        else if (type === 'ilike') query = query.ilike(column, value);
      });
    }
    
    // Apply ordering if provided
    if (options.order) {
      query = query.order(options.order.column, options.order);
    }
    
    // Apply limit if provided
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    // Apply single if provided
    if (options.single) {
      query = query.single();
    }
    
    const { data, error } = await query;
    
    if (error) {
      handleSupabaseError(error, `${operation} on ${table}`);
    }
    
    return data as T;
  } catch (error) {
    console.error(`Error in ${operation} operation on ${table}:`, error);
    throw new Error(`${errorMessage}: ${error.message}`);
  }
}

// Export a log event function for consistency
export async function logProcessingEvent(
  eventType: string,
  resourceId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    await supabaseClient.rpc('xdelo_logprocessingevent', {
      p_event_type: eventType,
      p_entity_id: resourceId,
      p_correlation_id: correlationId,
      p_metadata: metadata,
      p_error_message: errorMessage
    });
  } catch (error) {
    console.error('Failed to log processing event:', error);
    // Don't throw - we don't want logging failures to break the main flow
  }
}
