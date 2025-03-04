
// Types for the manual-caption-parser function
export interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number | null;
  notes?: string;
  caption?: string;
  parsing_metadata?: {
    method: 'manual';
    timestamp: string;
    quantity_pattern?: string;
    used_fallback?: boolean;
    original_caption?: string;
    error?: string;
  };
  sync_metadata?: {
    media_group_id?: string;
    sync_source_message_id?: string;
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
