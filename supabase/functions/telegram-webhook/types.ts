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
}

/**
 * Standardized structure for forwarded message information.
 * 
 * This interface is used by both media and text messages to
 * ensure consistent handling of forwarded content.
 * 
 * In PostgreSQL, this is stored as a JSONB object in the forward_info field.
 */
export interface ForwardInfo {
  /** Timestamp when the message was forwarded */
  date: number;
  
  /** ID of the chat the message was forwarded from */
  fromChatId?: number;
  
  /** Type of the chat the message was forwarded from (private, group, channel, etc.) */
  fromChatType?: string;
  
  /** Title of the chat the message was forwarded from */
  fromChatTitle?: string;
  
  /** ID of the original message in the source chat */
  fromMessageId?: number;
  
  /** ID of the user who sent the original message */
  fromUserId?: number;
  
  /** Whether the original sender is a bot */
  fromUserIsBot?: boolean;
  
  /** Sender name for messages forwarded from users who disallow adding a link to their account */
  fromName?: string;
  
  /** For messages forwarded from channels, signature of the post author */
  signature?: string;
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
  startTime?: string; // ISO date when processing started
  logger?: Logger; // Logger instance
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
