import { SupabaseClient as SupabaseClientType } from '@supabase/supabase-js';

export type SupabaseClient = SupabaseClientType;

export interface TelegramUpdate {
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: any;
  inline_query?: any;
  my_chat_member?: any;
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  caption?: string;
  edit_date?: number;
  media_group_id?: string;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  document?: TelegramDocument;
}

interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface ChatInfo {
  chat_id: number;
  chat_type: string;
  chat_title: string;
}

export interface MediaInfo {
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'syncing';

export interface MessageData {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title: string;
  caption?: string;
  media_group_id?: string | null;
  telegram_data: any;
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  public_url?: string;
  is_original_caption: boolean;
  is_edited?: boolean;
  edit_date?: string | null;
  processing_state?: ProcessingState;
  error_message?: string | null;
  group_message_count?: number;
  group_first_message_time?: string;
  group_last_message_time?: string;
  group_caption_synced?: boolean;
  analyzed_content?: any;
  created_at?: string;
  updated_at?: string;
}

export interface ExistingMessage extends MessageData {
  id: string;
}

export interface WebhookResponse {
  message: string;
  processed_media?: Array<{
    file_unique_id: string;
    message_id?: string;
    public_url?: string;
    is_edit?: boolean;
    needs_parsing?: boolean;
    group_synced?: boolean;
  }>;
}

export interface UploadResult {
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}
