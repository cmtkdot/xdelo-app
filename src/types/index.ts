
// Processing States
export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'no_caption';

// Message Interface
export interface Message {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  file_id?: string;
  file_unique_id?: string;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  public_url?: string;
  storage_path?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  analyzed_content?: Record<string, any>;
  processing_state: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  created_at: string;
  updated_at: string;
  telegram_data?: Record<string, any>;
  deleted_from_telegram?: boolean;
}

// Media Group Info
export interface MediaGroupInfo {
  messageCount: number;
  firstMessageTime: string | null;
  lastMessageTime: string | null;
  analyzedContent?: Record<string, any>;
}

// Processing Metadata
export interface ProcessingMetadata {
  state: ProcessingState;
  completedAt?: string;
  correlationId: string;
  lastProcessedAt: string;
  syncAttempt: number;
  error?: string;
}
