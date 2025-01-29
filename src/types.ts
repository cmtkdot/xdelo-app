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
  processing_state?: 'initialized' | 'caption_ready' | 'analyzing' | 'analysis_synced' | 'completed';
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: {
    product_name?: string;
    product_code?: string;
    vendor_uid?: string;
    purchase_date?: string;
    quantity?: number;
    notes?: string;
  } | null;
  telegram_data?: any;
}