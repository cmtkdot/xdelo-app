export interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  product_sku?: string;
  purchase_order_uid?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    fallbacks_used?: string[];
    timestamp: string;
    needs_ai_analysis?: boolean;
    manual_confidence?: number;
    ai_confidence?: number;
  };
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
}
