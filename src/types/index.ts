
export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
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

export interface Message {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id?: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  user_id: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent;
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  group_message_count?: number;
  chat_id?: number;
  chat_type?: string;
  message_url?: string;
  purchase_order?: string;
  glide_row_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MatchResult {
  id: string;
  message_id: string;
  product_id: string;
  confidence: number;
  matchType: string;
  details: {
    matchedFields: string[];
    confidence: number;
  };
}

export type MediaItem = Message;

export interface GlProduct {
  id: string;
  main_product_name: string;
  main_vendor_uid: string;
  main_vendor_product_name: string;
  main_product_purchase_date: string;
  main_total_qty_purchased: number;
  main_cost: number;
  main_category: string;
  main_product_image1: string;
  main_purchase_notes: string;
  product_name_display: string;
  created_at: string;
  updated_at: string;
  sync_status: string;
  message_public_url?: string | null;
  messages?: {
    public_url: string;
    media_group_id: string;
  }[];
}

// Helper functions
export const analyzedContentToJson = (content: AnalyzedContent): Json => {
  return {
    product_name: content.product_name,
    product_code: content.product_code,
    vendor_uid: content.vendor_uid,
    purchase_date: content.purchase_date,
    quantity: content.quantity,
    unit_price: content.unit_price,
    total_price: content.total_price,
    notes: content.notes,
    parsing_metadata: content.parsing_metadata
  };
};
