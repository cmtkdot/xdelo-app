export interface ParsedContent {
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
    quantity_confidence?: number;
    quantity_method?: string;
    quantity_is_approximate?: boolean;
    quantity_unit?: string;
    quantity_original?: string;
  };
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
  unit?: string;
  original_text: string;
  method: 'explicit' | 'numeric' | 'text' | 'fallback';
  is_approximate: boolean;
}