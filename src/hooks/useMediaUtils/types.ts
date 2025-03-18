
export interface RepairResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  successful?: number; // Number of successful repairs
  failed?: number; // Number of failed repairs
}

export interface SyncCaptionResult {
  success: boolean;
  message: string;
  error?: string;
  synced?: number;
  skipped?: number;
  data?: any;
}

export interface StandardizeResult {
  success: boolean;
  message?: string;
  error?: string;
  successful?: number;
  failed?: number;
}

// Add the MediaUtilsState interface that was missing
export interface MediaUtilsState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
}
