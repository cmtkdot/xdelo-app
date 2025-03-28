// Define ParsedContent directly since the import was removed
export interface ParsedContent {
  product_name: string;
  product_code: string;
  vendor_uid: string | null;
  purchase_date: string | null;
  quantity: number | null;
  notes: string;
  caption: string;
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
    force_reprocess?: boolean;
    reprocess_timestamp?: string;
    retry_count?: number;
    retry_timestamp?: string;
    error?: string;
  };
  sync_metadata?: {
    media_group_id?: string;
    sync_source_message_id?: string;
  };
}

export interface RequestPayload {
  messageId: string;
  media_group_id?: string;
  caption?: string;
  correlationId: string; // Always expecting a string
  queue_id?: string;
  file_info?: any;
  isEdit?: boolean;
  retryCount?: number;
  force_reprocess?: boolean;
}

export interface ParseResult {
  success: boolean;
  data: ParsedContent;
}

export interface MediaGroupResult {
  syncedCount?: number;
  success: boolean;
  source_message_id?: string;
  reason?: string;
  method?: string;
  details?: any;
  error?: string;
  fallbackError?: string;
}
