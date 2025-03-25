import { Logger } from './utils/logger.ts';

export interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  media_group_id?: string;
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  mime_type_original?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path: string;
  public_url?: string;
  correlation_id: string;
  processing_state: string;
  telegram_data: any;
  forward_info?: ForwardInfo;
  is_edited_channel_post?: boolean;
  edit_date?: string;
  is_duplicate?: boolean;
  is_forward?: boolean;
  edit_history?: any[];
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
  message_url?: string;
  text?: string;
  // Fields for handling duplicate content
  is_duplicate_content?: boolean;
  analyzed_content?: any;
  duplicate_of_message_id?: string;
  old_analyzed_content?: any[];
}

export interface ForwardInfo {
  is_forwarded?: boolean;
  from_chat_id?: number;
  from_message_id?: number;
  from_chat_title?: string;
  forward_date?: string;
  forward_origin_type?: string;
  forward_from_chat_id?: number;
  forward_from_chat_title?: string;
  forward_from_chat_type?: string;
  forward_from_message_id?: number;
  original_chat_id?: number;
  original_chat_title?: string;
  original_message_id?: number;
}

export interface MessageResult {
  success: boolean;
  id?: string;
  error_message?: string;
}

/**
 * Context provided to message handlers
 */
export interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: any;
  startTime: number; // Timestamp when processing started
  logger?: Logger; // Logger instance
  supabase?: any; // Direct Supabase client instance
}

/**
 * Simplified Telegram message type
 */
export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  date: number;
  text?: string;
  caption?: string;
  edit_date?: number;
  // Media types
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  // Forwarded message info
  forward_origin?: {
    type: string;
    date: number;
    chat?: {
      id: number;
      title?: string;
      type: string;
    };
    message_id?: number;
  };
  forward_from?: any;
  forward_from_chat?: any;
  forward_date?: number;
  // Media group ID for grouped media
  media_group_id?: string;
}
