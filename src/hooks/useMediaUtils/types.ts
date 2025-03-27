
// Types for media utility functions

export interface RepairResult {
  success: boolean;
  repaired?: number;
  error?: string;
  message?: string;
  details?: any[];
  successful?: number;
  failed?: number;
}

export interface MediaSyncOptions {
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
}

export interface ContentValidationRules {
  required?: string[];
  format?: Record<string, RegExp | string>;
  custom?: Record<string, (value: any) => boolean>;
}

export interface ValidationResult {
  valid: boolean;
  missing_fields?: string[];
  invalid_formats?: string[];
  custom_errors?: Record<string, string>;
}

export interface CaptionFlowData {
  success: boolean;
  message?: string;
  message_id?: string;
  media_group_synced?: boolean;
  caption_updated?: boolean;
}
