
import { logEvent, logMessageEvent, logSyncOperation, LogEventType } from "./logUtils";

/**
 * @deprecated Use logMessageEvent from logUtils.ts instead
 * This function is maintained for backward compatibility
 */
export async function logMessageOperation(
  action: string,
  messageId: string,
  metadata?: Record<string, any>,
  level: string = "info"
) {
  // Map the legacy action to the new LogEventType
  let eventType: LogEventType | string;
  
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
      eventType = action; // Keep as is for backward compatibility
      break;
    default:
      eventType = action; // Use the action string as fallback
  }
  
  // Add the level to metadata for backward compatibility
  const enhancedMetadata = {
    ...(metadata || {}),
    level,
    legacy_action: action
  };
  
  return logMessageEvent(eventType, messageId, enhancedMetadata);
}

// Export the old functions for backward compatibility
export { logSyncOperation, LogEventType };

// Default export for backward compatibility
export default {
  logMessageOperation,
  logSyncOperation,
  LogEventType
};
