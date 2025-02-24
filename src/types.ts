export type { Message, AnalyzedContent } from './types/Message';
export type { ProcessingState } from './types/Message';

export interface FilterValues {
  search?: string;
  dateRange?: { from: Date; to: Date } | null;
  processingState?: ProcessingState[];
  vendors?: string[];
  productCodes?: string[];
  quantity?: { min: number; max: number };
  sortOrder?: 'asc' | 'desc';
}

export interface ParsingMetadata {
  method: 'manual' | 'ai' | 'hybrid';
  confidence: number;
  timestamp: string;
  correlation_id?: string;
  needs_review?: boolean;
}

export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  product_sku?: string;
  purchase_order_uid?: string;
  parsing_metadata?: ParsingMetadata;
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}
