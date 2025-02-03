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
}

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: ParsingMetadata;
}

export interface ParsingMetadata {
  method: 'manual' | 'ai' | 'hybrid';
  confidence: number;
  fallbacks_used?: string[];
  reanalysis_attempted?: boolean;
  previous_analysis?: AnalyzedContent;
}

export type ProcessingState = "initialized" | "pending" | "processing" | "completed" | "error";

export interface FilterValues {
  search: string;
  vendor: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortOrder: "desc" | "asc";
  productCode?: string;
  quantityRange?: string;
  processingState?: ProcessingState | "all";
}

export interface MessageUpdate {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  analyzed_content?: AnalyzedContent | null;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
}

export interface MediaGroupSync {
  source_message_id: string;
  media_group_id: string;
  analyzed_content: AnalyzedContent;
  is_original_caption: boolean;
  group_caption_synced: boolean;
  processing_state: ProcessingState;
}

export interface ExistingMessage {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
  file_unique_id: string;
  caption?: string;
  analyzed_content?: AnalyzedContent;
  processing_state: ProcessingState;
  is_original_caption: boolean;
  group_caption_synced: boolean;
  message_caption_id?: string;
}

export interface MessageSyncResult {
  success: boolean;
  message_id: string;
  media_group_id?: string;
  error?: string;
  sync_details?: {
    is_original_caption: boolean;
    group_caption_synced: boolean;
    processing_state: ProcessingState;
    sync_timestamp: string;
  };
}