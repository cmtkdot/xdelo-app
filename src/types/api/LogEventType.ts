
/**
 * Event types for unified logging
 */
export enum LogEventType {
  // System events
  SYSTEM_STARTUP = 'system:startup',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  SYSTEM_ERROR = 'system:error',
  SYSTEM_WARNING = 'system:warning',
  SYSTEM_REPAIR = 'system:repair',
  
  // Message events
  MESSAGE_CREATED = 'message:created',
  MESSAGE_UPDATED = 'message:updated',
  MESSAGE_DELETED = 'message:deleted',
  MESSAGE_PROCESSED = 'message:processed',
  MESSAGE_PROCESSING_FAILED = 'message:processing_failed',
  MESSAGE_REPROCESSED = 'message:reprocessed',
  
  // Media events
  MEDIA_UPLOADED = 'media:uploaded',
  MEDIA_DOWNLOADED = 'media:downloaded',
  MEDIA_PROCESSED = 'media:processed',
  MEDIA_REDOWNLOADED = 'media:redownloaded',
  MEDIA_REPAIR_STARTED = 'media:repair_started',
  MEDIA_REPAIR_COMPLETED = 'media:repair_completed',
  MEDIA_REPAIR_FAILED = 'media:repair_failed',
  
  // User events
  USER_LOGIN = 'user:login',
  USER_LOGOUT = 'user:logout',
  USER_ACTION = 'user:action',
  
  // API events
  API_REQUEST = 'api:request',
  API_RESPONSE = 'api:response',
  API_ERROR = 'api:error',
  
  // Sync events
  SYNC_STARTED = 'sync:started',
  SYNC_COMPLETED = 'sync:completed',
  SYNC_FAILED = 'sync:failed',
  SYNC_PRODUCTS = 'sync:products',
  
  // Batch operations
  BATCH_OPERATION = 'batch:operation'
}
