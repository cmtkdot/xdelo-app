
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface FilterValues {
  search: string;
  vendor: string;
  dateField: 'purchase_date' | 'created_at';
  sortOrder: "asc" | "desc";
  processingState: string;
}

export interface AnalyzedContent {
  quantity?: number;
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai';
    confidence: number;
    timestamp: string;
  };
}

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'failed';

export type MessageType = {
  id: string;
  created_at: string;
  telegram_message_id: number;
  file_unique_id: string;
  user_id: string;
  caption?: string;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  file_id?: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  updated_at?: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent;
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  chat_id?: number;
  vendor_uid?: string;
  purchase_date?: string;
};

export type Message = MessageType;

export interface MatchResult {
  id: string;
  glide_id?: string;
  confidence: number;
  matchType: string;
  message_id: string;
  product_id: string;
  details: {
    matchedFields: string[];
    confidence: number;
  };
}

export type MediaItem = Message;
