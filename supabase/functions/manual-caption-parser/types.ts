
// Types for manual caption parser

export interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string | null;
  purchase_date?: string | null;
  quantity?: number | null;
  notes?: string;
  caption?: string;
  parsing_metadata: {
    method: 'manual';
    timestamp: string;
    partial_success?: boolean;
    missing_fields?: string[];
    quantity_pattern?: string;
    used_fallback?: boolean;
    original_caption?: string;
    is_edit?: boolean;
    edit_timestamp?: string;
    retry_count?: number;
    retry_timestamp?: string;
    error?: string;
  };
  sync_metadata?: {
    media_group_id?: string;
    sync_source_message_id?: string;
    sync_correlation_id?: string;
    sync_timestamp?: string;
  };
}

export interface MediaGroupResult {
  syncedCount?: number;
  success: boolean;
  source_message_id?: string;
  reason?: string;
  method?: string;
  details?: any;
  error?: string;
}
