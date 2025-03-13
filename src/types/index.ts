
// Re-export ProcessingState and Message types
export type { Message, ProcessingState } from './MessagesTypes';

// Define FilterValues type
export interface FilterValues {
  search: string;
  vendors: string[];
  sortOrder: "asc" | "desc";
  sortField: "created_at" | "purchase_date";
  showUntitled?: boolean;
  dateRange?: { from: Date; to: Date } | null;
  processingState?: ProcessingState[];
}

// SyncStatus definition
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'queued';

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
  parsing_metadata?: {
    method: 'manual' | 'ai';
    timestamp: string;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

export interface MessageProcessingStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  error: number;
  by_processing_state: Record<ProcessingState, number>;
  by_media_type: {
    photo: number;
    video: number;
    document: number;
    other: number;
  };
  processing_times: {
    avg_seconds: number;
    max_seconds: number;
  };
  latest_update: string;
}

// Export MediaItem type
export type { MediaItem } from './MediaViewer';

// Export Database type from supabase types
export type { Database } from '@/integrations/supabase/types';

// Export MatchResult for product matching 
export interface MatchResult {
  message_id: string;
  product_id: string;
  confidence: number;
  match_fields: string[];
  match_date: string;
}

export * from './GlProducts';
export * from './MessagesTypes';
