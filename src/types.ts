export interface MediaItem {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
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