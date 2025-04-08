
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
  message: string;
  messageId?: string;
  updatedFields?: string[];
  error?: string;
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
