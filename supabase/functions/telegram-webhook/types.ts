import { SupabaseClient } from "@supabase/supabase-js";

export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel';
export type ProcessingStateType = 
  | 'initialized'    // Initial state
  | 'pending'        // Waiting for processing
  | 'processing'     // Currently being processed
  | 'completed'      // Successfully processed
  | 'error'          // Failed processing
  | 'no_caption'     // No caption to process
  | 'group_pending'  // Waiting for group completion
  | 'deleted';       // Message was deleted
export type TelegramOtherMessageType = 
  | 'text'
  | 'command'
  | 'contact'
  | 'location'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'chat_member'
  | 'my_chat_member'
  | 'channel_post'
  | 'edited_message'
  | 'edited_channel_post'
  | 'venue'
  | 'poll'
  | 'dice'
  | 'game'
  | 'callback_query'
  | 'inline_query';

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
  file_name?: string;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated: boolean;
  thumb?: TelegramPhoto;
  emoji?: string;
  set_name?: string;
}

export interface TelegramDice {
  value: number;
  emoji: string;
}

export interface TelegramGame {
  title: string;
  description: string;
  photo: TelegramPhoto[];
}

export interface TelegramMemberUpdate {
  status: string;
  user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
}

export interface MessageContent {
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  sticker?: TelegramSticker;
  voice?: TelegramVoice;
  document?: TelegramDocument;
  location?: {
    latitude: number;
    longitude: number;
  };
  contact?: {
    phone_number: string;
    first_name: string;
    last_name?: string;
  };
}

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat: TelegramChat;
  media_group_id?: string;
  caption?: string;
  edit_date?: number;
  edit_history?: Array<{
    timestamp: string;
    previous_content: Record<string, any>;
    new_content: Record<string, any>;
  }>;
  photo?: TelegramPhoto[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  voice?: TelegramVoice;
  text?: string;
  sticker?: TelegramSticker;
  dice?: TelegramDice;
  location?: {
    latitude: number;
    longitude: number;
  };
  contact?: {
    phone_number: string;
    first_name: string;
    last_name?: string;
  };
  venue?: {
    location: {
      latitude: number;
      longitude: number;
    };
    title: string;
    address: string;
  };
  game?: TelegramGame;
  poll?: {
    id: string;
    question: string;
    options: Array<{
      text: string;
      voter_count: number;
    }>;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
    };
    data?: string;
  };
  inline_query?: {
    id: string;
    query: string;
  };
  entities?: TelegramEntity[];
  sender_chat?: {
    id: number;
    title?: string;
    type: string;
  };
  date: number;
  update_id?: number;
  is_edited?: boolean;
  is_channel?: boolean;
  telegram_data: {
    message: TelegramMessage;
    content: MessageContent;
    edit_history?: Array<{
      timestamp: string;
      previous_content: MessageContent;
      new_content: MessageContent;
    }>;
    member_update?: TelegramMemberUpdate;
  };
}

export interface ChatMemberUpdate {
  chat: {
    id: number;
    type: TelegramChatType;
    title?: string;
  };
  from?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  my_chat_member?: boolean;
  old_chat_member?: {
    status: string;
    user: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
  new_chat_member?: {
    status: string;
    user: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  };
  date: number;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramMessage['callback_query'];
  inline_query?: TelegramMessage['inline_query'];
  my_chat_member?: TelegramMemberUpdate;
  chat_member?: TelegramMemberUpdate;
  chat_join_request?: {
    chat: TelegramChat;
    from: TelegramMessage['from'];
    date: number;
  };
}

export interface ChatInfo {
  chat_id: number;
  chat_type: TelegramChatType;
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

export interface EditHistoryEntry {
  timestamp: string;
  previous_content: MessageContent;
  new_content: MessageContent;
}

export interface TelegramData {
  message: TelegramMessage;
  message_type: TelegramOtherMessageType;
  content: MessageContent;
  edit_history?: EditHistoryEntry[];
  update_type?: string;
  member_update?: TelegramMemberUpdate;
  old_status?: string;
  new_status?: string;
}

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  quantity?: number;
  purchase_date?: string;
  notes?: string;
  parsing_metadata: {
    method: 'manual' | 'ai';
    confidence: number;
    timestamp: string;
    correlation_id: string;
  };
  sync_metadata?: {
    sync_source_message_id: string;
    media_group_id: string;
  };
}

export interface MessageData {
  id: string;
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
  is_edited: boolean;
  edit_date?: string;
  edit_history?: Array<{
    timestamp: string;
    previous_content: {
      caption?: string;
    };
    new_content: {
      caption?: string;
    };
  }>;
  processing_state: ProcessingStateType;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_correlation_id?: string;
  analyzed_content?: AnalyzedContent;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  group_message_count?: number;
  group_completed_at?: string;
  telegram_data: TelegramData;
  message_url?: string;
  is_channel_post?: boolean;
  sender_chat_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TelegramError {
  message: string;
  name?: string;
  stack?: string;
  code?: string;
}

export interface OtherMessageData {
  id?: string;
  telegram_message_id: number;
  message_caption_id?: string;
  user_id: string;
  message_type: TelegramOtherMessageType;
  chat_id: number;
  chat_type: TelegramChatType;
  chat_title?: string;
  message_text?: string;
  is_edited: boolean;
  edit_date?: string | null;
  is_channel_post: boolean;
  sender_chat_id?: number;
  processing_state: ProcessingStateType;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_correlation_id: string;
  error_message?: string;
  telegram_data: TelegramData;
  message_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WebhookResponseDetails {
  messageId?: string;
  chatId?: number;
  mediaGroupId?: string;
  processingState?: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  correlation_id?: string;
  error?: string;
  details?: WebhookResponseDetails;
}

export interface MessageEvent {
  message: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}