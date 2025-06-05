
/**
 * Standard interface for analyzed message content
 */
export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  caption?: string;
  unit_price?: number;
  total_price?: number;
  parsing_metadata?: {
    method?: string;
    timestamp?: string;
    partial_success?: boolean;
  };
}
