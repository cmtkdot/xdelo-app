
import type { Message as BaseMessage } from "@/types";
import type { ProcessingState } from "@/types/api/ProcessingState";
import type { AnalyzedContent } from "@/types/utils/AnalyzedContent";

export type Message = BaseMessage;

export interface MessageUpdatePayload {
  id: string;
  caption?: string;
  processing_state?: ProcessingState;
  analyzed_content?: AnalyzedContent;
  needs_redownload?: boolean;
  redownload_reason?: string;
}

export interface MessageControlsProps {
  message: Message;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface MessageActionResult {
  success: boolean;
  message?: string;
  error?: Error;
  data?: any;
}
