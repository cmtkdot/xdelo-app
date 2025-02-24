
export interface WebhookLog {
  id?: string;
  created_at?: string;
  event_type: string;
  event_message?: string;
  correlation_id: string;
  metadata?: any;
}

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          caption?: string | null;
          file_id?: string | null;
          file_unique_id: string;
          media_group_id?: string | null;
          mime_type?: string | null;
          file_size?: number | null;
          width?: number | null;
          height?: number | null;
          duration?: number | null;
          public_url?: string | null;
          file_name?: string | null;
          analyzed_content?: Json | null;
          processing_state: ProcessingState;
          telegram_message_id?: number | null;
          chat_id?: number | null;
          chat_type?: TelegramChatType | null;
          chat_title?: string | null;
          telegram_data?: Json | null;
          is_edited?: boolean;
          is_channel?: boolean;
          update_id?: number | null;
          media_type?: 'photo' | 'video' | 'document' | null;
          is_deleted?: boolean;
          message_caption_id?: string | null;
          is_original_caption?: boolean;
          group_caption_synced?: boolean;
          error_message?: string | null;
          retry_count?: number | null;
          last_error_at?: string | null;
          group_first_message_time?: string | null;
          group_last_message_time?: string | null;
          message_url?: string | null;
          purchase_order_uid?: string | null;
          glide_row_id?: string | null;
          user_id?: string | null;
          processing_started_at?: string | null;
          processing_completed_at?: string | null;
          correlation_id?: string | null;
        };
      };
      gl_purchase_orders: {
        Row: {
          id: string;
          code: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Enums: {
      processing_state_type: 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'failed';
      telegram_chat_type: 'private' | 'group' | 'supergroup' | 'channel';
    };
  };
}

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
export type ProcessingState = Database['public']['Enums']['processing_state_type'];
export type TelegramChatType = Database['public']['Enums']['telegram_chat_type'];
