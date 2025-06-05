
import { Json } from '@/integrations/supabase/types';

/**
 * A standardized enum for message processing states across the application
 */
export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error' | 'initialized';

/**
 * Comprehensive Message interface containing all possible properties
 * used throughout the application
 */
export interface Message {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id: string; // Required
  public_url: string; // Required
  storage_path?: string;
  storage_path_standardized?: boolean | string; 
  storage_exists?: boolean | string;
  mime_type?: string;
  mime_type_verified?: boolean;
  mime_type_original?: string;
  content_disposition?: 'inline' | 'attachment';
  storage_metadata?: Record<string, any>;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  user_id?: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: Record<string, any>;
  old_analyzed_content?: Record<string, unknown>[];
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  message_url?: string;
  purchase_order?: string;
  glide_row_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_from_telegram?: boolean;
  is_forward?: boolean;
  forward_count?: number;
  original_message_id?: string;
  forward_from?: Record<string, unknown>;
  forward_from_chat?: Record<string, unknown>;
  forward_chain?: Record<string, unknown>[];
  needs_redownload?: boolean;
  redownload_reason?: string;
  redownload_flagged_at?: string;
  redownload_completed_at?: string;
  file_id_expires_at?: string;
  telegram_date?: string;
  is_bot?: boolean;
  message_type?: string;
  from_id?: number;
  is_duplicate?: boolean;
  duplicate_reference_id?: string;
  redownload_attempts?: number;
  correlation_id?: string;
  retry_count?: number;
  last_error_at?: string;
  edit_count?: number;
  forward_info?: Record<string, unknown>;
  edit_history?: Record<string, unknown>[];
  edit_date?: string;
  is_edited?: boolean;
  is_edited_channel_post?: boolean;
  
  // Fields from other interfaces that might be used in place of analyzed_content
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
}

export interface MessageApiResponse {
  data: Message[] | null;
  error: Error | null;
}
