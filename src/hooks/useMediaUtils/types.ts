
// Types for useMediaUtils hook

export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
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
  repaired?: number;
  message?: string;
  error?: string;
  details?: Array<{
    messageId: string;
    success: boolean;
    error?: string;
    message?: string;
  }>;
  successful?: number;
  failed?: number;
}

export interface CaptionFlowData {
  success: boolean;
  message: string;
  message_id?: string;
  media_group_synced?: boolean;
  caption_updated?: boolean;
  parsed_content?: any;
}
