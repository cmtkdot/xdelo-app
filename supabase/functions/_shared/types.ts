import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error' | 'initialized';

export interface ParsedContent extends Omit<AnalyzedContent, 'caption' | 'parsing_metadata'> {
  caption: string;
  parsing_metadata: AnalyzedContent['parsing_metadata'] & {
    method: 'manual' | 'ai' | 'v2';
    timestamp: string;
    partial_success?: boolean;
    missing_fields?: string[];
    quantity_pattern?: string;
    used_fallback?: boolean;
    original_caption?: string;
    is_edit?: boolean;
    edit_timestamp?: string;
    force_reprocess?: boolean;
    reprocess_timestamp?: string;
    retry_count?: number;
    retry_timestamp?: string;
    error?: string;
    stages?: ParsingStage[];
  };
  sync_metadata?: {
    media_group_id?: string;
    sync_source_message_id?: string;
  };
}

export interface ParsingStage {
  name: string;
  success: boolean;
  match?: string;
  error?: string;
}

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
  parsing_metadata: {
    method: 'manual' | 'ai' | 'v2';
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
    stages?: ParsingStage[];
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

// [Rest of the existing types file content remains unchanged...]
