
export interface RepairResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
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
