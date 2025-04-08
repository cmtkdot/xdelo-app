
export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: string[];
}

export interface MediaProcessingActions {
  setIsProcessing: (isProcessing: boolean) => void;
  addProcessingMessageId: (messageId: string) => void;
  removeProcessingMessageId: (messageId: string) => void;
}

export enum LogEventType {
  UPLOAD_STARTED = 'upload_started',
  UPLOAD_COMPLETED = 'upload_completed',
  UPLOAD_FAILED = 'upload_failed',
  DOWNLOAD_STARTED = 'download_started',
  DOWNLOAD_COMPLETED = 'download_completed',
  DOWNLOAD_FAILED = 'download_failed',
  DELETION_STARTED = 'deletion_started',
  DELETION_COMPLETED = 'deletion_completed',
  DELETION_FAILED = 'deletion_failed',
  REUPLOAD_STARTED = 'reupload_started',
  REUPLOAD_COMPLETED = 'reupload_completed',
  REUPLOAD_FAILED = 'reupload_failed',
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed'
}
