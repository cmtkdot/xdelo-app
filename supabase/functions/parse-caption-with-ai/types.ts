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
    reanalysis_attempted?: boolean;
  };
}

export interface AnalysisResult {
  message: string;
  analyzed_content: ParsedContent;
  processing_details?: {
    method: string;
    timestamp: string;
    group_id?: string;
  };
}