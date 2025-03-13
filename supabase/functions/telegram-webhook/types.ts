
export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: boolean;
  photo?: any;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  width: number;
  height: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size: number;
  thumbnail?: TelegramPhoto;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size: number;
  thumbnail?: TelegramPhoto;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_from_message_id?: number;
  forward_date?: number;
  forward_origin?: any;
  reply_to_message?: TelegramMessage;
  edit_date?: number;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  caption_entities?: any[];
  entities?: any[];
}

export interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: TelegramMessage;
}

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error' | 'initialized';

// Forward info type
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

// Define MessageInput interface to include public_url
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
  processing_state: ProcessingState;
  telegram_data: any;
  forward_info?: ForwardInfo;
  is_edited_channel_post?: boolean;
  edit_date?: string;
  is_duplicate?: boolean;
  is_forward?: boolean;
  edit_history?: any[];
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
}
