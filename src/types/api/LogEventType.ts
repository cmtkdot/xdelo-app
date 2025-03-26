
/**
 * Standardized event types for logging across the application
 */
export enum LogEventType {
  // System events
  SYSTEM_STARTUP = 'system_startup',
  SYSTEM_SHUTDOWN = 'system_shutdown',
  
  // User actions
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_ACTION = 'user_action',
  
  // Message events
  MESSAGE_CREATED = 'message_created',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_REPROCESSED = 'message_reprocessed',
  MESSAGE_ERROR = 'message_error',
  
  // Processing events
  PROCESSING_STARTED = 'processing_started',
  PROCESSING_COMPLETED = 'processing_completed',
  PROCESSING_FAILED = 'processing_failed',
  
  // Media events
  MEDIA_UPLOADED = 'media_uploaded',
  MEDIA_DOWNLOADED = 'media_downloaded',
  MEDIA_DELETED = 'media_deleted',
  MEDIA_REPAIRED = 'media_repaired',
  
  // Telegram events
  TELEGRAM_WEBHOOK = 'telegram_webhook',
  TELEGRAM_API_CALL = 'telegram_api_call',
  
  // Edge function events
  EDGE_FUNCTION_EXECUTED = 'edge_function_executed',
  EDGE_FUNCTION_ERROR = 'edge_function_error',
  
  // Database events
  DATABASE_TIMEOUT = 'database_timeout',
  DATABASE_RETRY = 'database_retry',
  DATABASE_ERROR = 'database_error',
  
  // Audit events
  AUDIT_EVENT = 'audit_event',
  CONFIG_CHANGED = 'config_changed',
  
  // Generic events
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  DEBUG = 'debug'
}
