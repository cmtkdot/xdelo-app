
/**
 * Interface for managing message processing state
 */
export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
}

/**
 * Actions for manipulating MediaProcessingState
 */
export interface MediaProcessingStateActions {
  setIsProcessing: (isProcessing: boolean) => void;
  addProcessingMessageId: (messageId: string) => void;
  removeProcessingMessageId: (messageId: string) => void;
}

/**
 * Options for media group synchronization
 */
export interface MediaSyncOptions {
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

/**
 * Result of a batch repair operation
 */
export interface RepairResult {
  success: boolean;
  repaired: number;
  error?: string;
  message?: string;
  details?: any[];
}

/**
 * Data returned from caption flow operations
 */
export interface CaptionFlowData {
  success: boolean;
  message: string;
  message_id: string;
  caption_updated?: boolean;
  media_group_synced?: boolean;
}
