
import type { Database } from './integrations/supabase/types';
export type { Database } from './integrations/supabase/types';
export type { Message, MessageWithPurchaseOrder, AnalyzedContent, ProcessingState } from './types/Message';

export interface MatchResult {
  id: string;
  message_id: string;
  product_id: string;
  confidence: number;
  match_confidence?: number;
  matchType: string;
  details: {
    matchedFields: string[];
    confidence: number;
  };
}

export interface FilterValues {
  search?: string;
  dateRange?: { from: Date; to: Date } | null;
  processingState?: ProcessingState[];
  vendors?: string[];
  productCodes?: string[];
  quantity?: { min: number; max: number };
  sortOrder?: 'asc' | 'desc';
}
