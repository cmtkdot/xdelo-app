
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

// Caption content validation types
export interface ContentValidationRules {
  required?: string[];
  format?: Record<string, RegExp>;
  custom?: Record<string, (value: any) => boolean>;
}

export interface ValidationResult {
  valid: boolean;
  missingFields: string[];
  invalidFormats: string[];
  customErrors: Record<string, string>;
}

export interface CaptionFlowData {
  id: string;
  content: string;
  stage: string;
  captionText?: string;
  analyzedContent?: Record<string, any>;
  validationResult?: ValidationResult;
}
