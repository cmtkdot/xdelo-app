
// Types for the parse-caption-with-ai function
export interface RequestPayload {
  messageId: string;
  media_group_id?: string;
  caption?: string;
  correlationId: string; // Always expecting a string
  queue_id?: string;
  file_info?: any;
  isEdit?: boolean;
}

export interface ParsedContent {
  product_name: string;
  product_code: string;
  vendor_uid: string;
  purchase_date: string;
  quantity: number | null;
  notes: string;
  caption: string;
  parsing_metadata: {
    method: 'manual' | 'ai' | 'hybrid';
    timestamp: string;
    confidence?: number;
    ai_error?: string;
    is_edit?: boolean;
    edit_timestamp?: string;
    original_manual_parse?: ParsedContent;
    ai_response?: string;
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
