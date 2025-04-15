
// Export all type definitions
export * from './entities/Message';
export * from './entities/ProductMatching';
export * from './utils/AnalyzedContent';
export * from './ProductMatching';
export * from './api/ProcessingState';

// Match result type from product matching library
export interface MatchResult {
  isMatch: boolean;
  score: number;
  productId?: string;
  product_id?: string;
  message_id?: string;
  confidence?: number;
  match_fields?: string[];
  match_date?: string;
  matchType?: string;
  details?: Record<string, any>;
  matches?: Record<string, { value: string; score: number }>;
  matchCriteria?: {
    nameMatch?: boolean;
    vendorMatch?: boolean;
    dateMatch?: boolean;
  };
}

// Batch match result
export interface BatchMatchResult {
  success: boolean;
  totalProcessed?: number;
  matchedCount?: number;
  unmatchedCount?: number;
  failedCount?: number;
  averageConfidence?: number;
  results: Array<{
    messageId: string;
    success: boolean;
    matched: boolean;
    confidence?: number;
    productId?: string;
    error?: string;
  }>;
  summary?: {
    total: number;
    matched: number;
    unmatched: number;
    failed: number;
  };
  error?: string;
}
