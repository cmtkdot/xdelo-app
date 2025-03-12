
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error';

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
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

// Forward info type
export interface ForwardInfo {
  from_chat_id?: number;
  from_message_id?: number;
  from_chat_title?: string;
  forward_date?: string;
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
  storage_exists?: boolean;    // Whether file exists in storage
  storage_path_standardized?: boolean; // Whether path follows standard format
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

export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId?: string
): Promise<void> {
  await supabase.rpc('xdelo_sync_media_group_content', {
    p_source_message_id: sourceMessageId,
    p_media_group_id: mediaGroupId,
    p_correlation_id: correlationId
  });
}

export interface MediaHandlingResult {
  success: boolean;
  file_unique_id: string;
  storage_path: string;
  public_url: string;
  error?: string;
  needs_redownload?: boolean;
}
