export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  forward_origin?: {
    type: string;
    chat?: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    message_id?: number;
    date?: number;
  };
  text?: string;
  photo?: {
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    width: number;
    height: number;
  }[];
  video?: {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    duration: number;
    file_size?: number;
    mime_type?: string;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  caption?: string;
  media_group_id?: string;
  edit_date?: number;
  entities?: any[];
  forward_date?: number;
  forward_from?: any;
  forward_from_chat?: any;
}

export interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: any; // Add this to store the original message before editing
  startTime: string;
  logger?: any;
}

export interface ForwardInfo {
  is_forwarded: boolean;
  forward_origin_type: string;
  forward_from_chat_id?: number;
  forward_from_chat_title?: string;
  forward_from_chat_type?: string;
  forward_from_message_id?: number;
  forward_date?: string;
  original_chat_id?: number;
  original_chat_title?: string;
  original_message_id?: number;
}

export interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  media_group_id?: string;
  file_id?: string;
  file_unique_id: string;
  mime_type?: string;
  mime_type_original?: string;
  storage_path?: string;
  public_url?: string;
  width?: number;
  height?: number;
  duration?: number;
  file_size?: number;
  correlation_id?: string;
  processing_state?: string;
  is_edited_channel_post?: boolean;
  forward_info?: ForwardInfo;
  telegram_data?: TelegramMessage;
  edit_date?: string;
  is_forward?: boolean;
  edit_history?: any[];
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
  needs_redownload?: boolean;
  redownload_reason?: string;
  redownload_flagged_at?: string;
  message_url?: string;
  error_message?: string;
}
