import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}

export interface MediaUploadResult {
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export interface ProcessedMedia {
  file_unique_id: string;
  public_url: string;
}

export interface WebhookResponse {
  message: string;
  processed_media?: ProcessedMedia[];
}

export type SupabaseClient = ReturnType<typeof createClient>;

export type ProcessingState = 'initialized' | 'caption_ready' | 'analyzing' | 'analysis_synced' | 'completed' | 'error';

export interface ExistingMessage {
  id: string;
  public_url: string;
  analyzed_content: any;
  processing_state: ProcessingState;
  group_caption_synced: boolean;
  media_group_id: string | null;
  is_original_caption?: boolean;
}