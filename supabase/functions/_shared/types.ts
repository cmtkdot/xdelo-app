import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
  telegram_message_id: number;
  chat_id: number;
  chat_title?: string;
  message_text?: string;
  caption?: string;
  media_group_id?: string;
  file_id?: string;
  file_unique_id?: string;
  mime_type?: string;
  width?: number;
  height?: number;
  duration?: number;
  file_size?: number;
  file_name?: string;
  is_edited?: boolean;
  is_forwarded?: boolean;
  forward_origin?: {
    type: string;
    chat?: {
      id: number;
      title?: string;
      type: string;
    };
    message_id?: number;
    date: number;
  };
  analyzed_content?: any;
  parsing_metadata?: ParsingMetadata;
  processing_state?: string;
  storage_path?: string;
  public_url?: string;
}

// Database interface
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

export async function getMediaGroupInfo(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<MediaGroupInfo | undefined> {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at', { ascending: true });

  if (!messages?.length) {
    return undefined;
  }

  // Find any analyzed content in the group
  const analyzedMessage = messages.find(m => m.analyzed_content);

  return {
    messageCount: messages.length,
    firstMessageTime: messages[0]?.created_at || null,
    lastMessageTime: messages[messages.length - 1]?.created_at || null,
    analyzedContent: analyzedMessage?.analyzed_content
  };
}

export interface MediaHandlingResult {
  success: boolean;
  file_unique_id: string;
  storage_path: string;
  public_url: string;
  error?: string;
  needs_redownload?: boolean;
}

/**
 * Shared types for Telegram webhook and message processing
 */

/**
 * Core message context for tracking processing
 */
export interface MessageContext {
  correlationId: string;
  isEdit: boolean;
  isChannelPost: boolean;
  isForwarded: boolean;
  startTime: string;
}

/**
 * Telegram message structure 
 */
export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    title?: string;
    type: string;
  };
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
    mime_type?: string;
    file_size?: number;
    file_name?: string;
  };
  caption?: string;
  edit_date?: number;
  media_group_id?: string;
  forward_origin?: {
    type: string;
    chat?: {
      id: number;
      title?: string;
      type: string;
    };
    message_id?: number;
    date: number;
  };
}

export interface MediaContent {
  file_id: string;
  file_unique_id: string;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
  file_size?: number;
  file_name?: string;
}

export interface MediaInfo {
  file_id: string;
  file_unique_id: string;
  mime_type?: string;
  width?: number;
  height?: number;
  duration?: number;
  file_size?: number;
  file_name?: string;
}

export interface MediaResult {
  success: boolean;
  isDuplicate?: boolean;
  fileInfo?: {
    mime_type: string;
    storage_path: string;
    public_url: string;
    file_size: number;
  };
  error?: string;
}

/**
 * Structure for message data to be saved to database
 */
export interface ParsingMetadata {
  method: "manual" | "ai";
  timestamp: string;
  partial_success?: boolean;
  missing_fields?: string[];
  quantity_pattern?: string;
  is_edit?: boolean;
  trigger_source?: string;
  error?: string;
  original_caption?: string;
  retry_count?: number;
  retry_timestamp?: string;
}

export type MessageInput = Omit<Message, 'id'>;

/**
 * Forward information structure
 */
export interface ForwardInfo {
  is_forwarded: boolean;
  from_chat_id?: number;
  from_message_id?: number;
  forward_date?: string;
  forward_origin_type?: string;
}

/**
 * Caption analysis request
 */
export interface CaptionAnalysisRequest {
  messageId: string;
  caption?: string;
  media_group_id?: string;
  correlationId?: string;
  isEdit?: boolean;
  trigger_source?: string;
}

/**
 * Media group synchronization result
 */
export interface MediaGroupResult {
  success: boolean;
  synced_count: number;
  media_group_id: string;
  error?: string;
}

/**
 * Analyzed caption content structure
 */
export interface AnalyzedContent {
  products: string[];
  prices: {
    amount: number;
    currency: string;
    raw: string;
  }[];
  tags: string[];
  content: string;
  raw_caption: string;
  parsing_metadata: {
    method: string;
    timestamp: string;
    original_caption: string;
    is_edit?: boolean;
    trigger_source?: string;
    error?: string;
  };
  error?: string;
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
}
