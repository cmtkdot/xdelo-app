
// Re-export all type definitions for easy importing throughout the app
// Using named exports to avoid ambiguity

// Core entity types with proper naming to avoid conflicts
export { ProcessingState } from './api/ProcessingState';
export { Message } from './entities/Message';
export { MediaItem } from './entities/MediaItem';
export { GlProduct } from './entities/Product';

// Additional types used throughout the app
export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'partial';

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
