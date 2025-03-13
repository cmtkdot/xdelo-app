export enum LogEventType {
  // System operations
  SYSTEM_STARTUP = "system_startup",
  SYSTEM_SHUTDOWN = "system_shutdown",
  SYSTEM_ERROR = "system_error",
  SYSTEM_REPAIR = "system_repair",
  SYSTEM_CONFIG_CHANGE = "system_config_change",
  SYSTEM_WARNING = "system_warning",
  SYSTEM_MAINTENANCE = "system_maintenance",
  
  // User actions
  USER_LOGIN = "user_login",
  USER_LOGOUT = "user_logout",
  USER_REGISTER = "user_register",
  USER_UPDATE = "user_update",
  USER_DELETE = "user_delete",
  USER_PASSWORD_RESET = "user_password_reset",
  USER_ACTION = "user_action",
  
  // Message operations
  MESSAGE_CREATED = "message_created",
  MESSAGE_UPDATED = "message_updated",
  MESSAGE_DELETED = "message_deleted",
  MESSAGE_REPROCESSED = "message_reprocessed",
  MESSAGE_PROCESSED = "message_processed",
  
  // Media operations
  MEDIA_UPLOAD = "media_upload",
  MEDIA_DOWNLOAD = "media_download",
  MEDIA_DELETE = "media_delete",
  MEDIA_REPAIR = "media_repair",
  MEDIA_GROUP_SYNC = "media_group_sync",
  MEDIA_GROUP_FETCH = "media_group_fetch",
  MEDIA_REPAIR_STARTED = "media_repair_started",
  MEDIA_REPAIR_COMPLETED = "media_repair_completed",
  MEDIA_REPAIR_FAILED = "media_repair_failed",
  
  // Telegram operations
  TELEGRAM_WEBHOOK = "telegram_webhook",
  TELEGRAM_BOT_UPDATE = "telegram_bot_update",
  TELEGRAM_MESSAGE_DELETE = "telegram_message_delete",
  
  // Processing operations
  PROCESSING_STATE_CHANGED = "processing_state_changed",
  CAPTION_ANALYZED = "caption_analyzed",
  CAPTION_PARSED = "caption_parsed",
  
  // Sync operations
  SYNC_STARTED = "sync_started",
  SYNC_COMPLETED = "sync_completed",
  SYNC_FAILED = "sync_failed",
  SYNC_PRODUCTS = "sync_products",
  
  // API operations
  API_REQUEST = "api_request",
  API_RESPONSE = "api_response",
  API_ERROR = "api_error",
  
  // Other operations
  STORAGE_OPERATION = "storage_operation",
  DATABASE_OPERATION = "database_operation"
}
