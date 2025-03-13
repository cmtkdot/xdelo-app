
export enum LogEventType {
  // Message events
  MESSAGE_CREATED = "message_created",
  MESSAGE_UPDATED = "message_updated",
  MESSAGE_DELETED = "message_deleted",
  MESSAGE_ANALYZED = "message_analyzed",
  MESSAGE_PROCESSED = "message_processed",
  
  // Webhook events
  WEBHOOK_RECEIVED = "webhook_received",
  
  // Media group events
  MEDIA_GROUP_SYNCED = "media_group_synced",
  MEDIA_GROUP_HISTORY_SYNCED = "media_group_history_synced",
  
  // Edit events
  MESSAGE_EDITED = "message_edited",
  
  // Caption events
  CAPTION_PROCESSED = "caption_processed",
  CAPTION_ANALYSIS_STARTED = "caption_analysis_started",
  CAPTION_ANALYSIS_COMPLETED = "caption_analysis_completed",
  CAPTION_ANALYSIS_FAILED = "caption_analysis_failed",
  
  // Storage events
  STORAGE_FILE_UPLOADED = "storage_file_uploaded",
  STORAGE_FILE_DELETED = "storage_file_deleted",
  STORAGE_FILE_VERIFIED = "storage_file_verified",
  STORAGE_FILE_MISSING = "storage_file_missing",
  STORAGE_PATH_UPDATED = "storage_path_updated",
  
  // Auth events
  USER_SIGNED_IN = "user_signed_in",
  USER_SIGNED_OUT = "user_signed_out",
  
  // User action events
  USER_ACTION = "user_action",
  
  // System events
  SYSTEM_ERROR = "system_error",
  SYSTEM_WARNING = "system_warning",
  WARNING = "warning",
  SYSTEM_INFO = "system_info",
  SYSTEM_REPAIR = "system_repair",
  SYSTEM_MAINTENANCE = "system_maintenance",
  
  // Processing events
  PROCESSING_STATE_CHANGED = "processing_state_changed",
  MESSAGE_QUEUED = "message_queued",
  MESSAGE_DEQUEUED = "message_dequeued",
  QUEUE_PROCESSING_STARTED = "queue_processing_started",
  QUEUE_PROCESSING_COMPLETED = "queue_processing_completed",
  QUEUE_PROCESSING_FAILED = "queue_processing_failed",
  
  // Redownload events
  REDOWNLOAD_REQUESTED = "redownload_requested",
  REDOWNLOAD_SUCCEEDED = "redownload_succeeded",
  REDOWNLOAD_FAILED = "redownload_failed",
  
  // AI events
  AI_ANALYSIS_REQUESTED = "ai_analysis_requested",
  AI_ANALYSIS_SUCCEEDED = "ai_analysis_succeeded",
  AI_ANALYSIS_FAILED = "ai_analysis_failed",
  
  // Media repair events
  MEDIA_REPAIR_STARTED = "media_repair_started",
  MEDIA_REPAIR_COMPLETED = "media_repair_completed",
  MEDIA_REPAIR_FAILED = "media_repair_failed",
  
  // Content disposition events
  CONTENT_DISPOSITION_UPDATED = "content_disposition_updated",
  
  // Path standardization events
  PATH_STANDARDIZATION_STARTED = "path_standardization_started",
  PATH_STANDARDIZATION_COMPLETED = "path_standardization_completed",
  PATH_STANDARDIZATION_FAILED = "path_standardization_failed",
  
  // Message processing events
  MESSAGE_PROCESSING_STARTED = "message_processing_started",
  MESSAGE_PROCESSING_ERROR = "message_processing_error",
  
  // Sync events
  SYNC_PRODUCTS = "sync_products",
  SYNC_STARTED = "sync_started",
  SYNC_COMPLETED = "sync_completed",
  SYNC_FAILED = "sync_failed"
}

export default LogEventType;
