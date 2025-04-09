// Define ParsedContent directly since the import was removed
export interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string; 
  purchase_date?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  raw_lines?: string[];
  raw_text?: string;
  currency?: string;
  metadata?: Record<string, any>;
  caption?: string;
  parsing_metadata: Record<string, any>;
  sync_metadata?: {
    media_group_id?: string;
    [key: string]: any;
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
