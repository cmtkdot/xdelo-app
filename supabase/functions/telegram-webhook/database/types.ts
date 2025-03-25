
import { ProcessingState, AnalyzedContent } from "../../_shared/types.ts";
import { ForwardInfo } from "../types.ts";

export interface LoggerInterface {
  error: (message: string, error: unknown) => void;
  info?: (message: string, data?: unknown) => void;
  warn?: (message: string, data?: unknown) => void;
}

export interface MessageResponse {
  id: string;
  success: boolean;
  error_message?: string;
  error_code?: string;
}

export interface BaseMessageRecord {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  correlation_id: string;
  processing_state: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent;
  old_analyzed_content?: AnalyzedContent[];
  error_message?: string;
  created_at: string;
  updated_at: string;
  telegram_data: Record<string, unknown>;
  edit_history?: Record<string, unknown>[];
  edit_count?: number;
  is_edited_channel_post?: boolean;
  forward_info?: ForwardInfo;
  edit_date?: string;
  user_id?: string;
  retry_count?: number;
  last_error_at?: string;
}

export interface MediaMessage extends BaseMessageRecord {
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  group_message_count?: number;
  group_first_message_time?: string;
  group_last_message_time?: string;
}

export interface NonMediaMessage extends BaseMessageRecord {
  message_type: string;
  message_text?: string;
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  product_quantity?: number;
  purchase_date?: string;
  notes?: string;
}

export interface UpdateProcessingStateParams {
  messageId: string;
  state: ProcessingState;
  analyzedContent?: AnalyzedContent;
  error?: string;
  processingStarted?: boolean;
  processingCompleted?: boolean;
}

export interface MessageInput {
  telegram_message_id: number;
  chat_id: number;
  chat_type?: string;
  chat_title?: string;
  caption?: string;
  media_group_id?: string;
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path: string;
  public_url: string;
  correlation_id?: string;
  telegram_data?: Record<string, unknown>;
  forward_info?: ForwardInfo;
  is_edited_channel_post?: boolean;
  message_url?: string;
}
