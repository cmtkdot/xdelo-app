
/**
 * Interface for managing message processing state
 */
export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
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
