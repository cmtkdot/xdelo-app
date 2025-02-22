import type { Message } from '@/types';

// Export the Message type for components
export type { Message };

// Re-export the database message type with a different name for components
export type MessageComponentData = Message;

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
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

export interface MessageData {
  id: string;
  user_id: string;
  telegram_message_id?: number;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id?: string;
  public_url?: string;
  storage_path?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  processing_state: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_correlation_id?: string;
  analyzed_content?: AnalyzedContent;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  telegram_data?: Record<string, any>;
  message_url?: string;
  is_channel_post?: boolean;
  sender_chat_id?: number;
  purchase_order?: string;
  glide_row_id?: string;
  created_at?: string;
  updated_at?: string;
}
