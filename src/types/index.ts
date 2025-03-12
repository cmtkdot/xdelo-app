
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'queued';

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error';

export interface Message {
  id: string;
  chat_id: number;
  message_id: number;
  text?: string;
  caption?: string;
  telegram_data: any;
  file_id?: string;
  file_unique_id?: string;
  media_group_id?: string;
  processing_state: ProcessingState;
  analyzed_content?: any;
  chat_type?: string;
  is_channel_post?: boolean;
  from_user_id?: number;
  processing_started_at?: string;
  processing_completed_at?: string;
  created_at: string;
  updated_at: string;
  storage_path?: string;
  public_url?: string;
  mime_type?: string;
  error_message?: string;
  error_code?: string;
  needs_redownload?: boolean;
  redownload_attempts?: number;
  storage_exists?: boolean;
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
