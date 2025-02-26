
import { SupabaseClient } from "@supabase/supabase-js";
import { ProcessingState, Message, AnalyzedContent } from "../_shared/types.ts";

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  date: number;
  media_group_id?: string;
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
    mime_type: string;
    file_size?: number;
  };
  caption?: string;
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
  forward_origin?: {
    type: string;
    chat: {
      id: number;
      title: string;
      type: string;
    };
    message_id: number;
    date: number;
  };
  forward_from_chat?: {
    id: number;
    title: string;
    type: string;
  };
  forward_from_message_id?: number;
  forward_date?: number;
  edit_date?: number;
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface MessageHandlerContext {
  supabaseClient: SupabaseClient;
  logger: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
  };
  correlationId: string;
  botToken: string;
}

export interface ProcessedMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
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

export interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  media_group_id?: string;
  caption?: string;
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  telegram_data: any;
  forward_info?: ForwardInfo;
  is_edited_channel_post?: boolean;
  edit_date?: string;
  correlation_id: string;
  processing_state: ProcessingState;
}

export { ProcessingState, Message, AnalyzedContent };

