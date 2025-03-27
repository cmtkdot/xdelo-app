
export interface RepairResult {
  success: boolean;
  repaired: number;
  details?: any[];
  message?: string;
  error?: string;
}

export interface MediaSyncOptions {
  forceSync?: boolean; 
  syncEditHistory?: boolean;
}

export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: string[];
}

export interface MediaProcessingStateActions {
  setIsProcessing: (value: boolean) => void;
  addProcessingMessageId: (id: string) => void;
  removeProcessingMessageId: (id: string) => void;
}
