
export interface ParsedResult {
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
    timestamp: string;
    fallbacks_used?: string[];
    needs_ai_analysis?: boolean;
  };
}

export type ProcessingState = 
  | 'initialized'    // Initial state
  | 'pending'        // Waiting for processing
  | 'processing'     // Currently being processed
  | 'completed'      // Successfully processed
  | 'error';         // Failed processing

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  quantity?: number;
  purchase_date?: string;
  notes?: string;
  parsing_metadata: {
    method: 'manual' | 'ai';
    confidence: number;
    timestamp: string;
    correlation_id: string;
  };
}

export interface AIAnalysisResult {
  content: AnalyzedContent;
  confidence: number;
}

export interface AnalysisRequest {
  messageId: string;
  caption: string;
  media_group_id?: string;
  correlation_id?: string;
}
