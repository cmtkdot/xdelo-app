
// Re-export all types from multiple files
// This allows us to import from a single location: import { Type } from '@/types'

// Re-export specific types with proper syntax to avoid conflicts/duplicates
export type { ProcessingState } from './api/ProcessingState';
export type { SyncStatus } from './api/SyncStatus';
export type { AnalyzedContent } from './utils/AnalyzedContent';
export type { MatchResult } from './utils/MatchResult';
export type { MessageProcessingStats } from './utils/MessageProcessingStats';
export type { FilterValues } from './ui/FilterValues';
export type { MediaItem } from './entities/MediaItem';
export type { Message } from './entities/Message';
export type { GlProduct } from './entities/Product';
export { LogEventType } from './api/LogEventType';
export type { StorageOperationResult, ApiResponse } from './api/SupabaseTypes';

// Export compatibility types
export * from './compatibility';
