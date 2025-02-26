import { SupabaseClient } from "@supabase/supabase-js";

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size?: number;
    width: number;
    height: number;
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
  media_group_id?: string;
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
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
}

export interface ProcessedMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface FunctionInvocationContext {
  supabaseClient: SupabaseClient;
  logger: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    warn?: (message: string, data?: any) => void;
  };
  correlationId: string;
}
