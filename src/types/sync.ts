
export interface SyncMetadata {
  sync_source_message_id: string;  // UUID
  media_group_id: string;
}

export interface ParsingMetadata {
  method: 'manual' | 'ai';
  timestamp: string;
  confidence?: number;
  needs_ai_analysis?: boolean;
}

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: ParsingMetadata;
  sync_metadata?: SyncMetadata;
}
