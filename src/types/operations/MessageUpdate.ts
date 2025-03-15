
import type { Message } from '../entities/Message';
import type { ProcessingState } from '../api/ProcessingState';
import type { AnalyzedContent } from '../utils/AnalyzedContent';

export interface MessageUpdatePayload {
  id: string;
  caption?: string;
  processing_state?: ProcessingState;
  analyzed_content?: AnalyzedContent;
  needs_redownload?: boolean;
  redownload_reason?: string;
}

export interface MessageActionResult {
  success: boolean;
  message?: string;
  error?: Error;
  data?: any;
}

export interface MessageControlsProps {
  message: Message;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}
