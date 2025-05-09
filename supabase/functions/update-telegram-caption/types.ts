
export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel';
export type ProcessingStateType = 'initialized' | 'pending' | 'processing' | 'completed' | 'partial_success' | 'error' | 'no_caption';
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
  sticker?: any;
  dice?: any;
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
  game?: any;
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
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramMessage['callback_query'];
  inline_query?: TelegramMessage['inline_query'];
  my_chat_member?: any;
  chat_member?: any;
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
  mime_type?: string;
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

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' ;
    fallbacks_used?: string[];
    timestamp: string;
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}
