
export interface ParsedResult {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    fallbacks_used?: string[];
    needs_ai_analysis?: boolean;
  };
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
}

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
    confidence: number;
    timestamp: string;
    manual_success?: boolean;
    fallbacks_used?: string[];
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

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

export interface AnalysisRequest {
  messageId: string;
  caption: string;
  media_group_id?: string;
  correlation_id?: string;
  chat_id?: number;
}
