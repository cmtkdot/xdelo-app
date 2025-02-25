
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/types'; // Using relative path to share types

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

