export interface ParsedResult {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  product_sku?: string;
  purchase_order_uid?: string;
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

export type ProcessingState = 
  | 'initialized'    // Initial state
  | 'pending'        // Waiting for processing
  | 'processing'     // Currently being processed
  | 'completed'      // Successfully processed
  | 'error'          // Failed processing
  | 'no_caption'     // No caption to process
  | 'group_pending'  // Waiting for group completion
  | 'deleted';       // Message was deleted

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  quantity?: number;
  purchase_date?: string;
  notes?: string;
  parsing_metadata: {
    method: 'manual' | 'ai';
    confidence: number;
    timestamp: string;
    correlation_id: string;
  };
  sync_metadata?: {
    sync_source_message_id: string;
    media_group_id: string;
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

export interface ParserEvent {
  event_type: 'analysis_start' | 'analysis_complete' | 'analysis_error';
  message_id: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface RequestData {
  messageId: string;
  caption: string;
  correlationId: string;
  media_group_id?: string;
}
