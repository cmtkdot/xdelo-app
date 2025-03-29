export interface Message {
  id: string;
  file_unique_id: string; // Required
  public_url: string;
  created_at?: string;
  updated_at?: string;
  telegram_message_id?: number;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  caption?: string;
  text?: string;
  media_group_id?: string;
  file_id?: string;
  mime_type?: string;
  mime_type_original?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path?: string;
  message_url?: string;
  correlation_id?: string;
  processing_state?: string;
  telegram_data?: Record<string, unknown>;
  telegram_metadata?: Record<string, unknown>;
  forward_info?: {
    from_id?: number;
    from_name?: string;
    from_chat_id?: number;
    from_chat_name?: string;
    date?: string;
    signature?: string;
  };
  is_edited_channel_post?: boolean;
  edit_date?: string;
  is_duplicate?: boolean;
  duplicate_reference_id?: string;
  is_forward?: boolean;
  edit_history?: Array<{
    date?: string;
    editor_id?: number;
    old_caption?: string;
    old_text?: string;
    changes?: Record<string, unknown>;
  }>;
  analyzed_content?: {
    product_name?: string;
    product_code?: string;
    vendor_uid?: string;
    purchase_date?: string;
    quantity?: number;
    notes?: string;
    caption?: string;
    unit_price?: number;
    total_price?: number;
    parsing_metadata?: {
      method?: string;
      timestamp?: string;
      partial_success?: boolean;
    };
  };
  old_analyzed_content?: Array<Record<string, unknown>>;
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  deleted_from_telegram?: boolean;
  storage_path_standardized?: string | boolean;
  storage_exists?: string | boolean;
  content_disposition?: 'inline' | 'attachment';
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
}
