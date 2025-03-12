
import { Json } from '@/integrations/supabase/types';

// ProcessingState matches the simplified database enum
export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error';

// Add MessageProcessingStats type for the message queue hook
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

export interface Message {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  chat_title: string;
  chat_type: 'private' | 'group' | 'supergroup' | 'channel';
  telegram_date: string;
  mime_type: string | null;
  caption: string | null;
  analyzed_content: Json | null;
  is_bot: boolean;
  message_type: string;
  from_id: number | null;
  from_is_bot: boolean | null;
  from_first_name: string | null;
  from_username: string | null;
  photo: Json | null;
  video: Json | null;
  document: Json | null;
  width: number | null;
  height: number | null;
  file_id: string | null;
  file_unique_id: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string | null;
  public_url: string | null;
  processing_state: ProcessingState;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  media_group_id: string | null;
  media_unique_file_id: string | null;
  is_original_caption: boolean | null;
  group_caption_synced: boolean | null;
  correlation_id: string | null;
  error_message: string | null;
  error_code: string | null;
  storage_exists: boolean | null;
  storage_path_standardized: boolean | null;
  storage_path: string | null;
}

export interface MessageApiResponse {
  data: Message[] | null;
  error: Error | null;
}
