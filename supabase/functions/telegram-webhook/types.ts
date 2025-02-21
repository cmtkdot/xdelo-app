import { SupabaseClient } from "@supabase/supabase-js";

export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel';
export type ProcessingStateType = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';
export type TelegramOtherMessageType = 'text' | 'sticker' | 'poll' | 'dice' | 'location' | 
                                     'contact' | 'venue' | 'game' | 'chat_member' | 
                                     'edited_message' | 'edited_channel_post';

export interface TelegramChat {
  id: number;
  type: TelegramChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width: number;
  height: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  mime_type?: string;
  width: number;
  height: number;
  duration: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  mime_type?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  date: number;
  edit_date?: number;
  text?: string;
  caption?: string;
  media_group_id?: string;
  sender_chat?: any;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  document?: TelegramDocument;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  my_chat_member?: any;
  chat_join_request?: any;
}

export interface ChatInfo {
  chat_id: number;
  chat_type: TelegramChatType;
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

export interface MessageData {
  user_id: string;
  telegram_message_id: number;
  chat_id: number;
  chat_type: TelegramChatType;
  chat_title: string;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id?: string;
  public_url?: string;
  storage_path?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  is_edited?: boolean;
  edit_date?: string | null;
  edit_history?: Record<string, any>;
  processing_state: ProcessingStateType;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_correlation_id?: string;
  analyzed_content?: Record<string, any>;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  group_message_count?: number;
  group_completed_at?: string;
  telegram_data: Record<string, any>;
  message_url?: string;
  is_channel_post?: boolean;
  sender_chat_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface OtherMessageData {
  user_id: string;
  message_type: TelegramOtherMessageType;
  telegram_message_id: number;
  chat_id: number;
  chat_type: TelegramChatType;
  chat_title?: string;
  message_text?: string;
  is_edited: boolean;
  edit_date?: string | null;
  processing_state: ProcessingStateType;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_correlation_id?: string;
  error_message?: string;
  telegram_data: Record<string, any>;
  message_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  correlation_id?: string;
  error?: string;
  details?: Record<string, any>;
}

export interface StateLogEntry {
  message_id: string;
  previous_state: ProcessingStateType;
  new_state: ProcessingStateType;
  changed_at?: string;
}