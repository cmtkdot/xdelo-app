
export interface DatabaseMessage {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  caption?: string;
  analyzed_content?: AnalyzedContent;
  processing_state?: ProcessingState;
  chat_id?: number;
  chat_type?: string;
  telegram_data?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export type ProcessingState = 
  | 'initialized'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'error';

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    correlation_id?: string;
  };
}

export interface WebhookPayload {
  message_id: string;
  chat_id: number;
  caption?: string;
  media_group_id?: string;
}

export interface ParseResult {
  success: boolean;
  analyzed_content?: AnalyzedContent;
  error?: string;
}
