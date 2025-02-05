import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}

export interface MediaUploadResult {
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export interface ProcessedMedia {
  file_unique_id: string;
  public_url: string;
}

export interface WebhookResponse {
  message: string;
  processed_media?: ProcessedMedia[];
}

export type SupabaseClient = ReturnType<typeof createClient>;

export type ProcessingState = 
  | 'initialized' 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'error';

// Essential Telegram data we need to store
export interface TelegramMessageData {
  chat_id: number;
  chat_type: string;
  message_id: number;
  from_id?: number;
  date: number;
  edit_date?: number;
  forward_from_chat?: Record<string, any>;
  forward_from_message_id?: number;
  media_group_id?: string;
  deleted_at?: string;
}

export interface ExistingMessage {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
  file_unique_id: string;
  caption?: string;
  analyzed_content?: Record<string, any>;
  processing_state: ProcessingState;
  is_original_caption: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  telegram_data: TelegramMessageData;
  public_url?: string;
}

export interface MessageData {
  telegram_message_id: number;
  media_group_id?: string;
  caption?: string;
  file_id: string;
  file_unique_id: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  user_id: string;
  telegram_data: TelegramMessageData;
  processing_state: ProcessingState;
  group_message_count?: number | null;
  is_original_caption?: boolean;
  is_deleted?: boolean;
  deleted_at?: string;
  analyzed_content?: Record<string, any> | null;
  error_message?: string;
}