
export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error' | 'initialized';

export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: string[];
}

export interface MediaProcessingActions {
  setIsProcessing: (isProcessing: boolean) => void;
  addProcessingMessageId: (id: string) => void;
  removeProcessingMessageId: (id: string) => void;
  resetProcessingMessageIds: () => void;
}

export interface MediaSyncOptions {
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

export interface RepairResult {
  success: boolean;
  repaired: number;
  error?: string;
  message?: string;
  details?: any[];
}

export interface CaptionFlowData {
  success: boolean;
  message?: string;
  message_id?: string;
  caption_updated?: boolean;
  media_group_synced?: boolean;
  analyzed_content?: any;
}

export interface CaptionParams {
  messageId: string;
  caption: string;
}
