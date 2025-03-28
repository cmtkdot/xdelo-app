
export interface Message {
  id: string;
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
  file_unique_id?: string;
  mime_type?: string;
  mime_type_original?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path?: string;
  public_url?: string;
  correlation_id?: string;
  processing_state?: string;
  telegram_data?: any;
  telegram_metadata?: any;
  forward_info?: any;
  is_edited_channel_post?: boolean;
  edit_date?: string;
  is_duplicate?: boolean;
  duplicate_reference_id?: string;
  is_forward?: boolean;
  edit_history?: any[];
  analyzed_content?: {
    product_name?: string;
    product_code?: string;
    vendor_uid?: string;
    purchase_date?: string;
    quantity?: number;
    notes?: string;
    caption?: string;
    parsing_metadata?: {
      method?: string;
      timestamp?: string;
      partial_success?: boolean;
    };
  };
  vendor_uid?: string;
  deleted_from_telegram?: boolean;
}
