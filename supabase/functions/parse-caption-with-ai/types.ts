export interface ParsedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai';
    confidence: number;
    fallbacks_used?: string[];
  };
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
  original_text: string;
  method: 'explicit' | 'numeric' | 'text' | 'fallback';
  is_approximate: boolean;
}