
// This file maintains backward compatibility with old type imports
// to avoid breaking changes during refactoring

import type { Message } from './entities/Message';
import type { GlProduct } from './entities/Product';
import type { MediaItem } from './entities/MediaItem';
import type { ProcessingState } from './api/ProcessingState';
import type { SyncStatus } from './api/SyncStatus';
import type { AnalyzedContent } from './utils/AnalyzedContent';
import type { MatchResult } from './utils/MatchResult';
import type { FilterValues } from './ui/FilterValues';
import type { MessageProcessingStats } from './utils/MessageProcessingStats';
import type { StorageOperationResult, ApiResponse } from './api/SupabaseTypes';
import type { LogEventType } from './api/LogEventType';

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
  MessageProcessingStats,
  StorageOperationResult,
  ApiResponse,
  LogEventType
};

// Clean up legacy exports
export * from './entities/Product';
