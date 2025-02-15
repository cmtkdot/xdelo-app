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

export interface ProcessingMetadata {
  correlation_id: string;
  timestamp: string;
  method: string;
  confidence: number;
  original_caption: string;
  message_id: string;
  reanalysis_attempted: boolean;
  group_message_count?: number;
  is_original_caption?: boolean;
}

export interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}

export interface MediaItem {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  created_at?: string;
  updated_at?: string;
  user_id: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent | null;
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
}

export interface FilterValues {
  search: string;
  vendor: string;
  dateFrom?: Date;
  dateTo?: Date;
  dateField: 'purchase_date' | 'created_at';
  sortOrder: 'asc' | 'desc';
  productCode?: string;
  quantityRange?: string;
  processingState?: ProcessingState | 'all';
}

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

// Helper functions to convert types to JSON
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

export const processingMetadataToJson = (metadata: ProcessingMetadata): Json => {
  return {
    correlation_id: metadata.correlation_id,
    timestamp: metadata.timestamp,
    method: metadata.method,
    confidence: metadata.confidence,
    original_caption: metadata.original_caption,
    message_id: metadata.message_id,
    reanalysis_attempted: metadata.reanalysis_attempted,
    group_message_count: metadata.group_message_count,
    is_original_caption: metadata.is_original_caption
  };
};
