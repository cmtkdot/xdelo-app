
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'queued';

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error';

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
    timestamp: string;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

export interface Message {
  id: string;
  telegram_message_id?: number;
  chat_id?: number;
  caption?: string;
  telegram_data?: any;
  file_id?: string;
  file_unique_id?: string;
  media_group_id?: string;
  processing_state?: ProcessingState;
  analyzed_content?: AnalyzedContent;
  chat_type?: string;
  chat_title?: string;
  from_user_id?: number;
  processing_started_at?: string;
  processing_completed_at?: string;
  created_at?: string;
  updated_at?: string;
  storage_path?: string;
  public_url?: string;
  mime_type?: string;
  error_message?: string;
  error_code?: string;
  needs_redownload?: boolean;
  redownload_attempts?: number;
  storage_exists?: boolean;
  message_type?: string;
  is_bot?: boolean;
  telegram_date?: string;
  from_id?: number;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  width?: number;
  height?: number;
  duration?: number;
  is_forward?: boolean;
  correlation_id?: string;
}

export interface MessageProcessingStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  error: number;
  by_processing_state: Record<ProcessingState, number>;
  by_media_type: {
    photo: number;
    video: number;
    document: number;
    other: number;
  };
  processing_times: {
    avg_seconds: number;
    max_seconds: number;
  };
  latest_update: string;
}

export * from './GlProducts';
export * from './MessagesTypes';
