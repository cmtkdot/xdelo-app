
// Types for the parse-caption-with-ai function
export interface RequestPayload {
  messageId: string;
  media_group_id?: string;
  caption?: string;
  correlationId: string;
  queue_id?: string;
  file_info?: any;
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
}
