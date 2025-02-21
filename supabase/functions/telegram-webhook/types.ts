import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  date: number;
  edit_date?: number;
  text?: string;
  caption?: string;
  media_group_id?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    width: number;
    height: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    mime_type?: string;
    width: number;
    height: number;
    duration: number;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    mime_type?: string;
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface ChatInfo {
  chat_id: number;
  chat_type: string;
  chat_title: string;
}

export interface MediaInfo {
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
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
  group_caption_synced: boolean;
  message_caption_id?: string;
  public_url?: string;
}

export interface MessageData {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title: string;
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
  telegram_data: Record<string, any>;
  processing_state: ProcessingState;
  group_first_message_time?: string | null;
  group_last_message_time?: string | null;
  group_message_count?: number | null;
  is_original_caption?: boolean;
  is_edited?: boolean;
  edit_date?: string | null;
  analyzed_content?: Record<string, any> | null;
  error_message?: string;
  group_caption_synced?: boolean;
  message_url?: string;
}

export interface ProcessedMedia {
  file_unique_id: string;
  public_url: string;
}

export interface WebhookResponse {
  message: string;
  processed_media?: ProcessedMedia[];
}

export interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}
