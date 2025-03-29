
// Re-export all type definitions for easy importing throughout the app
export * from './api/ProcessingState';
export * from './entities/Message';
export * from './entities/MediaItem';
export * from './entities/Product';
export * from './MessagesTypes';
export * from './MediaItem';
export * from './GlProducts';
export * from './GlobalTypes';

// Define SyncStatus type which was referenced but not defined
export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// Export AnalyzedContent interface for common use
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

// Export MatchResult interface for product matching
export interface MatchResult {
  id: string;
  message_id: string;
  product_id: string;
  confidence: number;
  matchType: string;
  details: {
    matchedFields: string[];
    confidence: number;
  };
}
