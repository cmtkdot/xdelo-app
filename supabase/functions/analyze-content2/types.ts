export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
}

export interface AIResponse {
  caption: string;
  extracted_data: AnalyzedContent;
  confidence: number;
  timestamp: string;
  model_version: string;
  error?: string;
}