
/**
 * Standard event types for logging throughout the application
 */
export enum LogEventType {
  // Message events
  MESSAGE_CREATED = 'message_created',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_PROCESSED = 'message_processed',
  MESSAGE_ANALYZED = 'message_analyzed',
  MESSAGE_ERROR = 'message_error',
  
  // Media processing events
  MEDIA_UPLOADED = 'media_uploaded',
  MEDIA_DOWNLOADED = 'media_downloaded',
  MEDIA_ERROR = 'media_error',
  MEDIA_REPAIRED = 'media_repaired',
  
  // Sync events
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_ERROR = 'sync_error',
  PRODUCT_MATCHED = 'product_matched',
  
  // User actions
  USER_ACTION = 'user_action',
  SYSTEM_REPAIR = 'system_repair',
  
  // Legacy events (for backward compatibility)
  DUPLICATE_FILE = 'duplicate_file_detected',
  NON_MEDIA_MESSAGE = 'non_media_message_created',
  PROCESSING_STATE_CHANGED = 'processing_state_changed',
  WEBHOOK_RECEIVED = 'webhook_received',
  SYSTEM = 'system',
  
  // Additional event types from database
  WARNING = 'warning',
  ERROR = 'error',
  INFO = 'info',
  DEBUG = 'debug',
  EDGE_FUNCTION_ERROR = 'edge_function_error'
}
