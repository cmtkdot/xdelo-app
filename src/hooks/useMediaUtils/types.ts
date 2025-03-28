
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
 * State types for media operations
 */
export interface MediaUtilsState {
  isProcessing: boolean;
  processingMessageIds: Record<string, boolean>;
}
