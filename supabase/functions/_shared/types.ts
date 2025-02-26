export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'no_caption';

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    fallbacks_used?: string[];
    timestamp: string;
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

// Keeping ParsedContent for backward compatibility
export interface ParsedContent extends AnalyzedContent {}

export interface AIAnalysisResult {
  content: AnalyzedContent;
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
