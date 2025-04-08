
import { Message } from '@/types/entities/Message';

/**
 * Result type for media operations
 */
export interface RepairResult {
  success: boolean;
  message?: string;
  successful?: number;
  failed?: number;
  error?: string;
  data?: any;
}

/**
 * Media processing state
 */
export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
}

/**
 * Media processing state actions
 */
export interface MediaProcessingStateActions {
  setIsProcessing: (value: boolean) => void;
  addProcessingMessageId: (id: string) => void;
  removeProcessingMessageId: (id: string) => void;
}
