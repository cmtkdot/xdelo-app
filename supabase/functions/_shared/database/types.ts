
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Logger } from "../logger/index.ts";

// Processing state enum
export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error' | 'initialized';

// Types for analyzed content
export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai';
    timestamp: string;
    partial_success?: boolean;
    missing_fields?: string[];
    quantity_pattern?: string;
    is_edit?: boolean;
    edit_timestamp?: string;
    force_reprocess?: boolean;
    reprocess_timestamp?: string;
    retry_count?: number;
    retry_timestamp?: string;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

// Forward info type
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
}

// Base Message type that matches our database schema
export interface Message {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  caption?: string;
  file_id?: string;
  file_unique_id: string;
  public_url: string;
  mime_type?: string;
  mime_type_verified?: boolean;
  mime_type_original?: string;
  content_disposition?: 'inline' | 'attachment';
  storage_metadata?: Record<string, any>;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  user_id?: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent;
  old_analyzed_content?: AnalyzedContent[];
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  message_url?: string;
  purchase_order?: string;
  glide_row_id?: string;
  edit_count?: number;
  forward_info?: ForwardInfo;
  created_at?: string;
  updated_at?: string;
  deleted_from_telegram?: boolean;
  edit_history?: AnalyzedContent[];
  file_id_expires_at?: string; // Timestamp when file_id expires
  original_file_id?: string;   // The original file_id that created this record
  needs_redownload?: boolean;  // Flag to indicate file needs redownloading
  redownload_reason?: string;  // Reason why redownload is needed
  redownload_completed_at?: string; // When redownload completed
  storage_path?: string;       // Path in storage
  storage_exists?: boolean | string;    // Whether file exists in storage
  storage_path_standardized?: boolean | string; // Whether path follows standard format
  is_forward?: boolean;
  forward_count?: number;
  original_message_id?: string;
  forward_from?: Record<string, unknown>;
  forward_from_chat?: Record<string, unknown>;
  forward_chain?: Record<string, unknown>[];
  redownload_flagged_at?: string;
  telegram_date?: string;
  is_bot?: boolean;
  message_type?: string;
  from_id?: number;
  is_duplicate?: boolean;
  duplicate_reference_id?: string;
  redownload_attempts?: number;
  correlation_id?: string;
  retry_count?: number;
  last_error_at?: string;
}

// Input type for creating messages
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
  processing_state: ProcessingState | string;
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

// Base database record interface
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

// Media message type
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

// Non-media message type
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

// Response type for message operations
export interface MessageResponse {
  id: string;
  success: boolean;
  error_message?: string;
  error_code?: string;
}

// Params for updating processing state
export interface UpdateProcessingStateParams {
  messageId: string;
  state: ProcessingState;
  analyzedContent?: AnalyzedContent;
  error?: string;
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

// Database interface for type safety
export interface Database {
  public: {
    Tables: {
      messages: {
        Row: Message;
        Insert: Partial<Message>;
        Update: Partial<Message>;
      };
      webhook_logs: {
        Row: {
          id: string;
          created_at?: string;
          event_type: string;
          chat_id?: number;
          telegram_message_id?: number;
          media_type?: string;
          raw_data?: Record<string, unknown>;
          correlation_id?: string;
        };
        Insert: any;
        Update: any;
      };
      unified_audit_logs: {
        Row: {
          id: string;
          event_type: string;
          entity_id: string;
          previous_state?: Record<string, unknown>;
          new_state?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Insert: any;
        Update: any;
      };
    };
  };
}

export interface MediaGroupInfo {
  messageCount: number;
  firstMessageTime: string | null;
  lastMessageTime: string | null;
  analyzedContent?: Record<string, any>;
}

export interface MediaHandlingResult {
  success: boolean;
  file_unique_id: string;
  storage_path: string;
  public_url: string;
  error?: string;
  needs_redownload?: boolean;
} 
