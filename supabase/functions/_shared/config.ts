
export const CONFIG = {
  // General settings
  DEBUG: process.env.DEBUG === 'true',
  
  // Retry settings
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY_MS: 1000,
  
  // Timeouts
  PROCESSING_TIMEOUT_MS: 60000, // 1 minute
  STORAGE_OPERATION_TIMEOUT_MS: 30000, // 30 seconds
  
  // Batch settings
  MAX_BATCH_SIZE: 50,
  
  // Error messages
  ERROR_MESSAGES: {
    MEDIA_GROUP_NOT_FOUND: 'Media group not found',
    STORAGE_UPLOAD_FAILED: 'Failed to upload file to storage',
    INVALID_MESSAGE_ID: 'Invalid message ID',
    PROCESSING_TIMEOUT: 'Operation timed out',
    AUTHORIZATION_FAILED: 'Authorization failed',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  },
  
  // Success messages
  SUCCESS_MESSAGES: {
    MEDIA_GROUP_SYNCED: 'Media group successfully synchronized',
    CAPTION_PROCESSED: 'Caption processed successfully',
    STORAGE_FILE_VALIDATED: 'Storage file validated',
  },
  
  // Function names (for logging)
  FUNCTION_NAMES: {
    TELEGRAM_WEBHOOK: 'telegram-webhook',
    CAPTION_PROCESSOR: 'direct-caption-processor',
    MEDIA_GROUP_REPAIR: 'direct-media-group-repair',
    STORAGE_VALIDATOR: 'validate-storage-files',
  }
};

export default CONFIG;
