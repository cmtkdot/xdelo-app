
/**
 * Type definitions for compatibility with existing database views
 * and APIs that may not align perfectly with our main types
 */
import type { ProcessingState } from './api/ProcessingState';

export interface LegacyMessage {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  caption?: string;
  file_id?: string;
  file_unique_id?: string;
  public_url: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  processing_state?: ProcessingState;
  analyzed_content?: Record<string, any>;
  telegram_data?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  is_forward?: boolean;
  edit_count?: number;
  forward_info?: Record<string, any>;
  edit_history?: Record<string, any>[];
}

export interface LegacyMessageResponse {
  data: LegacyMessage[] | null;
  error: Error | null;
}

export interface LegacyProduct {
  id: string;
  product_name: string;
  product_code?: string;
  vendor_uid?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  purchase_date?: string;
  notes?: string;
  message_id: string;
  created_at: string;
  updated_at?: string;
  media_url: string;
  mime_type?: string;
  width?: number;
  height?: number;
}
