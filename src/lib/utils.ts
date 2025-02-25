
import { Message } from "@/types";

// Common formatters
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export const messageToMediaItem = (message: Message) => {
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content || undefined
  };
};

// Re-export other utilities
export * from './generalUtils';

// Explicitly import and re-export from productMatching to avoid conflicts
import { findMatches, matchProduct, updateProduct } from './productMatching';
export { findMatches, matchProduct, updateProduct };

// Re-export everything except logSyncOperation from syncUtils
import { logSyncOperationBatch, logSyncWarning } from './syncUtils';
export { logSyncOperationBatch, logSyncWarning };

// We'll use logSyncOperation from productMatching
export { logSyncOperation } from './productMatching';

