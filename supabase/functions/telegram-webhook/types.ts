
import { Logger } from '../_shared/logger/index.ts';

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

export type MessageOperationType = 'create' | 'update' | 'delete' | 'forward' | 'reprocess';

export enum ForwardOriginType {
  USER = 'user',
  HIDDEN_USER = 'hidden_user',
  CHANNEL = 'channel',
  CHAT = 'chat'
}

export enum ProcessingState {
  INITIALIZED = 'initialized',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
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
  forward_chain?: Record<string, any>[]; // Track the chain of forwards
}
