
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
    STORAGE_NOT_AVAILABLE: 'Storage service unavailable',
    STORAGE_FILE_NOT_FOUND: 'File not found in storage',
    TELEGRAM_BOT_TOKEN_MISSING: 'Telegram bot token is missing',
    WEBHOOK_URL_MISSING: 'Webhook URL is not configured',
  },
  
  // Success messages
  SUCCESS_MESSAGES: {
    MEDIA_GROUP_SYNCED: 'Media group successfully synchronized',
    CAPTION_PROCESSED: 'Caption processed successfully',
    STORAGE_FILE_VALIDATED: 'Storage file validated',
    MEDIA_DOWNLOADED: 'Media successfully downloaded',
  },
  
  // Function names (for logging)
  FUNCTION_NAMES: {
    TELEGRAM_WEBHOOK: 'telegram-webhook',
    CAPTION_PROCESSOR: 'direct-caption-processor',
    MEDIA_GROUP_REPAIR: 'direct-media-group-repair',
    STORAGE_VALIDATOR: 'validate-storage-files',
    FILE_REPAIR: 'xdelo_file_repair',
    CONTENT_DISPOSITION: 'xdelo_fix_content_disposition',
    WEBHOOK_VALIDATOR: 'xdelo_validate_webhook',
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
  },
  
  // Telegram settings
  TELEGRAM: {
    WEBHOOK_PATH: 'telegram-webhook',
    WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    MAX_CONNECTIONS: 10,
    ALLOWED_UPDATES: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
  },
  
  // Logging levels
  LOG_LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
  
  // Current log level (can be overridden with env var)
  CURRENT_LOG_LEVEL: process.env.LOG_LEVEL ? 
    parseInt(process.env.LOG_LEVEL) : 
    (process.env.NODE_ENV === 'production' ? 1 : 0),
};

export default CONFIG;
