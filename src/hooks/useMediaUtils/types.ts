
export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: string[];
}

export interface MediaProcessingStateActions {
  setIsProcessing: (isProcessing: boolean) => void;
  addProcessingMessageId: (messageId: string) => void;
  removeProcessingMessageId: (messageId: string) => void;
}

export interface MediaSyncOptions {
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

export interface RepairResult {
  success: boolean;
  repaired: number;
  message?: string;
  error?: string;
  successful?: number;
  failed?: number;
  details?: any[];
}

export interface CaptionFlowData {
  success: boolean;
  message?: string;
  message_id: string;
  caption_updated?: boolean;
  media_group_synced?: boolean;
}
