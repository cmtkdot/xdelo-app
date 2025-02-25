export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    fallbacks_used?: string[];
    timestamp: string;
    needs_ai_analysis?: boolean;
    manual_confidence?: number;
    ai_confidence?: number;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

// Keeping ParsedContent for backward compatibility
export interface ParsedContent extends AnalyzedContent {}

export interface QuantityParseResult {
  value: number;
  confidence: number;
}
