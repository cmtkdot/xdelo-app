
export const CONFIG = {
  // General settings
  DEBUG: process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production',
  
  // Environment detection
  IS_PRODUCTION: process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production',
  IS_DEV: process.env.APP_ENV === 'development' || process.env.NODE_ENV === 'development',
  
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
  },

  // Storage buckets
  STORAGE: {
    TELEGRAM_MEDIA_BUCKET: 'telegram-media',
    AUDIO_UPLOADS_BUCKET: 'audio-uploads',
    PUBLIC_BUCKET: 'public',
  },
  
  // API endpoints
  API: {
    TELEGRAM_API: 'https://api.telegram.org',
    DEFAULT_TIMEOUT_MS: 10000,
  }
};

export default CONFIG;
