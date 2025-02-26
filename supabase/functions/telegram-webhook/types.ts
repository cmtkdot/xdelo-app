
import { SupabaseClient } from "@supabase/supabase-js";

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
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
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
