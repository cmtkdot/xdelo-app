
import { supabase } from "@/integrations/supabase/client";
import { LogEventType, logEvent } from "@/lib/logUtils";

export interface SyncLogEntry {
  operation: string;
  entityId: string;
  details?: Record<string, any>;
  status?: 'started' | 'completed' | 'error';
  errorMessage?: string;
}

/**
 * Utility for standardized logging of sync operations
 */
export const syncLogger = {
  /**
   * Log a sync operation start
   */
  logStart: (operation: string, entityId: string, details?: Record<string, any>) => {
    return logSync({
      operation,
      entityId,
      details,
      status: 'started'
    });
  },

  /**
   * Log a sync operation completion
   */
  logComplete: (operation: string, entityId: string, details?: Record<string, any>) => {
    return logSync({
      operation,
      entityId,
      details,
      status: 'completed'
    });
  },

  /**
   * Log a sync operation error
   */
  logError: (operation: string, entityId: string, errorMessage: string, details?: Record<string, any>) => {
    return logSync({
      operation,
      entityId,
      details,
      status: 'error',
      errorMessage
    });
  }
};

/**
 * Map operations to appropriate event types
 */
function getEventType(operation: string, status?: 'started' | 'completed' | 'error'): LogEventType {
  if (operation === 'sync_products') {
    return LogEventType.SYNC_PRODUCTS;
  }
  
  if (status === 'started') {
    return LogEventType.SYNC_STARTED;
  } else if (status === 'completed') {
    return LogEventType.SYNC_COMPLETED;
  } else if (status === 'error') {
    return LogEventType.SYNC_FAILED;
  }
  
  return LogEventType.SYNC_OPERATION;
}

/**
 * Log a sync operation with standardized format
 */
async function logSync(log: SyncLogEntry) {
  try {
    const eventType = getEventType(log.operation, log.status);
    
    const metadata: Record<string, any> = {
      operation: log.operation,
      status: log.status,
      ...log.details
    };
    
    if (log.errorMessage) {
      metadata.errorMessage = log.errorMessage;
    }
    
    await logEvent(eventType, log.entityId, metadata);
    
    return { success: true };
  } catch (error) {
    console.error('Error in syncLogger:', error);
    return { success: false, error };
  }
}

// Export a function to log message operations for compatibility with other modules
export const logMessageOperation = async (
  eventType: LogEventType, 
  messageId: string, 
  metadata: Record<string, any> = {}
) => {
  await logEvent(eventType, messageId, metadata);
};

export function getSyncStatusColor(status?: string) {
  switch (status) {
    case 'completed':
      return { color: 'green', variant: 'success' };
    case 'started':
      return { color: 'blue', variant: 'default' };
    case 'error':
      return { color: 'red', variant: 'destructive' };
    default:
      return { color: 'gray', variant: 'secondary' };
  }
}

export function getSyncEventIcon(eventType: string) {
  switch (eventType) {
    case LogEventType.SYNC_STARTED:
      return { icon: 'Play', color: 'blue' };
    case LogEventType.SYNC_COMPLETED:
      return { icon: 'CheckCircle', color: 'green' };
    case LogEventType.SYNC_FAILED:
      return { icon: 'AlertCircle', color: 'red' };
    case LogEventType.SYNC_PRODUCTS:
      return { icon: 'Package', color: 'purple' };
    default:
      return { icon: 'RefreshCw', color: 'gray' };
  }
}

export default {
  ...syncLogger,
  logMessageOperation,
  getSyncStatusColor,
  getSyncEventIcon
};
