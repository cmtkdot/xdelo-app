
// Basic JSON type
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Processing state
export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

// Filter values interface
export interface FilterValues {
  search: string;
  vendor: string;
  dateField: 'purchase_date' | 'created_at';
  sortOrder: "asc" | "desc";
  processingState: string;
}

// Analyzed content interface
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

// Message interface
export interface Message {
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
  purchase_order?: string;
}

// Match result interface
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

// MediaItem type
export type MediaItem = Message;

// Processing Metadata interface
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
