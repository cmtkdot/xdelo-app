import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AnalyzedContent } from "../_shared/types.ts";
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types'; // Using relative path to share types

// Database Types
export interface EditHistoryEntry {
  edit_date: string;
  previous_caption: string;
  new_caption: string;
  is_channel_post: boolean;
}

export interface MessageData {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  media_group_id?: string;
  caption: string;
  file_id: string;
  file_unique_id: string;
  public_url?: string;
  storage_path: string;
  mime_type: string;
  file_size?: number;
  width: number;
  height: number;
  duration?: number;
  processing_state: ProcessingStateType;
  telegram_data: Record<string, unknown>;
  is_edited?: boolean;
  edit_date?: string;
  edit_history?: EditHistoryEntry[] | null;
  edited_channel_post?: string;
  update_id?: string;
  analyzed_content?: AnalyzedContent | null;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  group_message_count?: string;
  group_first_message_time?: string;
  group_last_message_time?: string;
  message_caption_id?: string;
  processing_correlation_id?: string;
  processing_completed_at?: string;
  created_at: string;
  updated_at: string;
  error_message?: string;
  last_error_at?: string;
  is_channel_post?: boolean;
  correlation_id?: string;
  media_type?: string;
  user_id?: string;
  product_name?: string;
  product_quantity?: number;
  product_unit?: string;
  vendor_name?: string;
  product_sku?: string;
  is_miscellaneous_item?: boolean;
  purchase_date?: string;
  purchase_order?: string;
  retry_count?: number;
  sync_attempt?: number;
  message_url?: string;
  glide_row_id?: string;
  deleted_from_telegram?: boolean;
  notes?: string;
  product_code?: string;
  vendor_uid?: string;
  parsed_caption?: string;
  parsed_notes?: string;
  parsed_product_code?: string;
  parsed_purchase_date?: string;
  parsed_quantity?: number;
  parsed_total_price?: number;
  parsed_unit_price?: number;
  parsed_vendor_uid?: string;
}

export interface OtherMessageData {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  message_type: string;
  message_text?: string;
  telegram_data: Record<string, unknown>;
  is_edited: boolean;
  edit_date?: string;
  edit_history?: EditHistoryEntry[] | null;
  created_at: string;
  updated_at: string;
  processing_state: ProcessingStateType;
  processing_started_at?: string;
  processing_completed_at?: string;
  processing_correlation_id?: string;
  analyzed_content?: AnalyzedContent | null;
  error_message?: string;
  correlation_id?: string;
  message_url?: string;
  notes?: string;
  product_code?: string;
  product_name?: string;
  product_quantity?: number;
  purchase_date?: string;
  vendor_name?: string;
  vendor_uid?: string;
  user_id?: string;
}

export type ProcessingStateType = 
  | 'initialized' 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'error';

export interface StateLogEntry {
  message_id: string;
  previous_state: ProcessingStateType;
  new_state: ProcessingStateType;
  changed_by: string;
  notes?: string;
  correlation_id?: string;
}

// Telegram API Types
export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  video?: TelegramVideo;
  document?: TelegramDocument;
  media_group_id?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface WebhookResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: Error;
}

// Configuration Types
export interface Config {
  supabaseUrl: string;
  supabaseKey: string;
  telegramBotToken: string;
  webhookSecret: string;
}

// Database Operation Types
export interface DbOperationResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: Error;
}

// Media Processing Types
export interface MediaProcessingResult {
  success: boolean;
  publicUrl?: string;
  error?: Error;
  metadata: Record<string, unknown>;
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
}

// Analysis Types
export interface AnalysisResult {
  success: boolean;
  content?: Record<string, unknown>;
  confidence?: number;
  error?: Error;
}

// Logging Types
export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// Error Types
export interface WebhookError extends Error {
  code?: string;
  details?: Record<string, unknown>;
}

export interface ProcessingError extends Error {
  stage?: string;
  metadata?: Record<string, unknown>;
}
