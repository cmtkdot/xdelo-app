
// Main types barrel file - exports all type definitions
// organized by domain/purpose

// Core entity types
export * from './entities/Message';
export * from './entities/Product';
export * from './entities/MediaItem';

// UI related types
export * from './ui/FilterValues';
export * from './ui/MediaViewer';

// API related types
export * from './api/SupabaseTypes';
export * from './api/SyncStatus';
export * from './api/ProcessingState';

// Utility types
export * from './utils/AnalyzedContent';
export * from './utils/MatchResult';
export * from './utils/MessageProcessingStats';

// Legacy type exports for backward compatibility
export * from './compatibility';
