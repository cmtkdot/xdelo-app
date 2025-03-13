
import { logEvent, logMessageEvent, logSyncOperation, LogEventType } from "./logUtils";

/**
 * @deprecated Use logMessageEvent from logUtils.ts instead
 * This function is maintained for backward compatibility
 */
export async function logMessageOperation(
  action: string | LogEventType,
  messageId: string,
  metadata?: Record<string, any>,
  level: string = "info"
) {
  // Map the legacy action to the new LogEventType
  let eventType: LogEventType | string;
  
  if (typeof action === 'string') {
    switch (action) {
      case 'update':
        eventType = LogEventType.MESSAGE_UPDATED;
        break;
      case 'delete':
        eventType = LogEventType.MESSAGE_DELETED;
        break;
      case 'process':
        eventType = LogEventType.MESSAGE_PROCESSED;
        break;
      case 'analyze':
        eventType = LogEventType.MESSAGE_ANALYZED;
        break;
      case 'error':
        eventType = LogEventType.MESSAGE_ERROR;
        break;
      case 'warning':
        eventType = LogEventType.WARNING;
        break;
      default:
        eventType = action; // Use the action string as fallback
    }
  } else {
    eventType = action; // Already a LogEventType
  }
  
  // Add the level to metadata for backward compatibility
  const enhancedMetadata = {
    ...(metadata || {}),
    level,
    legacy_action: typeof action === 'string' ? action : null
  };
  
  return logMessageEvent(eventType, messageId, enhancedMetadata);
}

// Export the consolidated logging functions for backward compatibility
export { logEvent, logMessageEvent, logSyncOperation, LogEventType };

// Default export for backward compatibility
export default {
  logMessageOperation,
  logMessageEvent,
  logSyncOperation,
  logEvent,
  LogEventType
};
