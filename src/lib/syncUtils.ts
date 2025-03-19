
import { supabase } from "@/integrations/supabase/client";
import { logEvent, LogEventType } from "@/lib/logUtils";

// Use the internal version of GlProduct that has the required fields
interface InternalGlProduct {
  id: string;
  glide_id?: string | null;
  sync_status?: string;
  [key: string]: any;
}

/**
 * Checks if a product has been synced to Glide
 */
export const isProductSynced = (product: InternalGlProduct) => {
  return product.glide_id && product.sync_status === 'synced';
};

/**
 * Checks if a product is pending sync
 */
export const isProductPendingSync = (product: InternalGlProduct) => {
  return product.sync_status === 'pending';
};

/**
 * Logs a system warning about sync operations
 */
export const logSyncWarning = async (
  entityId: string,
  warningMessage: string,
  details?: Record<string, any>
) => {
  try {
    await logEvent(
      LogEventType.SYSTEM_WARNING,
      entityId,
      {
        message: warningMessage,
        type: 'sync_warning',
        ...details
      }
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error logging sync warning:', error);
    return { success: false, error };
  }
};

/**
 * Gets pending sync items from the database
 */
export const getPendingSyncItems = async (tableName: string, limit = 10) => {
  try {
    // For type safety, we'll check if the table name is one of our known tables
    if (!tableName || typeof tableName !== 'string') {
      throw new Error('Invalid table name');
    }
    
    // Use a type cast to work around the type limitations
    // This is safer than using 'any' directly
    const query = supabase
      .from(tableName as any)
      .select('*')
      .eq('sync_status', 'pending')
      .order('updated_at', { ascending: true })
      .limit(limit);
      
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error(`Error getting pending sync items from ${tableName}:`, error);
    
    // Log the error
    await logEvent(
      LogEventType.SYSTEM_WARNING,
      'system',
      {
        message: `Failed to get pending sync items from ${tableName}`,
        error: error.message,
        table: tableName
      }
    );
    
    return { success: false, error };
  }
};

export default {
  isProductSynced,
  isProductPendingSync,
  logSyncWarning,
  getPendingSyncItems
};
