
import { Json } from '@/integrations/supabase/types';
import { AnalyzedContent } from './index';

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error';

export interface Message {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id: string;
  public_url: string;
  storage_path?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  user_id?: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent;
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
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
  old_analyzed_content?: Record<string, unknown>[];
  needs_redownload?: boolean;
  redownload_reason?: string;
  redownload_flagged_at?: string;
  redownload_completed_at?: string;
  file_id_expires_at?: string;
  telegram_date: string;
  is_bot: boolean;
  message_type: string;
  from_id: number;
  is_duplicate?: boolean;
  duplicate_reference_id?: string;
  redownload_attempts?: number;
  correlation_id?: string;
}

export interface MessageApiResponse {
  data: Message[] | null;
  error: Error | null;
}

export interface MessageProcessingStats {
  state_counts: {
    pending: number;
    processing: number;
    completed: number;
    error: number;
    total_messages: number;
  };
  media_group_stats?: {
    unprocessed_with_caption?: number;
    stuck_in_processing?: number;
    stalled_no_media_group?: number;
    orphaned_media_group_messages?: number;
  };
  timing_stats?: {
    avg_processing_time_seconds?: number;
    oldest_unprocessed_caption_age_hours?: number;
    oldest_stuck_processing_hours?: number;
  };
  media_type_counts?: {
    photo_count: number;
    video_count: number;
    document_count: number;
    other_count: number;
  };
  processing_stats?: {
    avg_processing_seconds: number;
    max_processing_seconds: number;
  };
  timestamp?: string;
}
