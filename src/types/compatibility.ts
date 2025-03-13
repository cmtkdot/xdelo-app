
// This file maintains backward compatibility with old type imports
// to avoid breaking changes during refactoring

import type { Message } from './entities/Message';
import type { GlProduct } from './entities/Product';
import type { MediaItem } from './ui/MediaViewer';
import type { ProcessingState } from './api/ProcessingState';
import type { SyncStatus } from './api/SyncStatus';
import type { AnalyzedContent } from './utils/AnalyzedContent';
import type { MatchResult } from './utils/MatchResult';
import type { FilterValues } from './ui/FilterValues';
import type { MessageProcessingStats } from './utils/MessageProcessingStats';

// Legacy types for backward compatibility
export type {
  Message,
  GlProduct,
  MediaItem,
  ProcessingState,
  SyncStatus,
  AnalyzedContent,
  MatchResult,
  FilterValues,
  MessageProcessingStats
};

// Create a compatibility type for legacy code
export interface SyncLog {
  id: string;
  table_name: string;
  record_id: string;
  glide_id: string;
  operation: string;
  status: string;
  created_at: string;
  error_message?: string;
}

// Clean up legacy exports
export * from './entities/Product';
