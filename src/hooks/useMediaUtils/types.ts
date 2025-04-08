
export interface MediaUtilsOptions {
  maxRetries?: number;
  useBatchOperations?: boolean;
}

export interface MediaRepairOptions {
  redownload?: boolean;
  validateMime?: boolean;
  standardizePath?: boolean;
  force?: boolean;
}

export interface RepairResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors: Record<string, string>;
  messages: string[];
}

export interface BatchOperationResult {
  successCount: number;
  failureCount: number;
  results: RepairResult[];
}

export interface MediaValidationResult {
  valid: boolean;
  issues: string[];
  messageId: string;
  recommendedActions?: string[];
}

export interface ValidationOptions {
  checkMimeType?: boolean;
  checkStorage?: boolean;
  checkPath?: boolean;
  checkDimensions?: boolean;
}

export interface BatchValidationResult {
  validCount: number;
  invalidCount: number;
  results: MediaValidationResult[];
}

export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
}

export interface MediaProcessingStateActions {
  setIsProcessing: (isProcessing: boolean) => void;
  addProcessingMessageId: (id: string) => void;
  removeProcessingMessageId: (id: string) => void;
}
