
import { AnalyzedContent } from "../_shared/types.ts";

export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'no_caption';

export interface AIAnalysisResult {
  content: AnalyzedContent;
  confidence: number;
}

export interface MessageUpdate {
  analyzed_content: AnalyzedContent;
  processing_state: ProcessingState;
  processing_completed_at?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  message_caption_id?: string;
  error_message?: string;
  last_error_at?: string;
}
