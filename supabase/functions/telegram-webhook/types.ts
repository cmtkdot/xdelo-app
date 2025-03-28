import { Logger } from "./utils/logger.ts";

/**
 * Input format for message creation
 */
export interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  text?: string;
  media_group_id?: string;
  file_id?: string;
  file_unique_id?: string;
  mime_type?: string;
  mime_type_original?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path?: string;
  public_url?: string;
  correlation_id: string;
  processing_state: string;
  telegram_data: any;
  telegram_metadata?: any;
  forward_info?: ForwardInfo;
  is_edited_channel_post?: boolean;
  edit_date?: string;
  is_duplicate?: boolean;
  duplicate_reference_id?: string;
  is_forward?: boolean;
  edit_history?: any[];
  old_analyzed_content?: any[];
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
  message_url?: string;
  message_text?: string;
  message_type?: string;
}

export interface ForwardInfo {
  is_forwarded: boolean;
  forward_origin_type?: string;
  forward_from_chat_id?: number;
  forward_from_chat_title?: string;
  forward_from_chat_type?: string;
  forward_from_message_id?: number;
  forward_date?: string;
  original_chat_id?: number;
  original_chat_title?: string;
  original_message_id?: number;
}

/**
 * Context provided to message handlers
 */
export interface MessageContext {
  correlationId: string;
  isChannelPost: boolean;
  isForwarded: boolean;
  isEdit: boolean;
  previousMessage?: TelegramMessage;
  logger?: any;
  startTime: string;
  metadata?: any;
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

export interface MessageProcessResult {
  success: boolean;
  id?: string;
  status?: string;
  error?: string;
  action?: string;
  needsProcessing?: boolean;
  editHistoryId?: string;
  editCount?: number;
}

export interface MediaProcessResult {
  success: boolean;
  fileInfo?: any;
  mediaData?: any;
  error?: string;
}
