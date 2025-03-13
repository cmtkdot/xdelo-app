
import { Message } from "@/types/entities/Message";
import { AnalyzedContent } from "@/types/utils/AnalyzedContent";
import { MediaItem } from "@/types/ui/MediaViewer";

// Common formatters
export function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Converts a Message to a MediaItem for use in the MediaViewer
 */
export const messageToMediaItem = (message: Message): MediaItem => {
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || '',
    file_unique_id: message.file_unique_id || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content as AnalyzedContent || undefined,
    caption: message.caption
  };
};

// Export from generalUtils
export { cn } from './generalUtils';

// Explicitly import and re-export from productMatching to avoid conflicts
import { findMatches, matchProduct, updateProduct } from './productMatching';
export { findMatches, matchProduct, updateProduct };

// Export our sync utils with consistent xdelo_ naming
import { 
  xdelo_logSyncOperation, 
  xdelo_logSyncOperationBatch, 
  xdelo_logSyncWarning,
  // Also export legacy names for backward compatibility
  logSyncOperation, 
  logSyncOperationBatch, 
  logSyncWarning 
} from './syncUtils';

export { 
  xdelo_logSyncOperation, 
  xdelo_logSyncOperationBatch, 
  xdelo_logSyncWarning,
  // Legacy exports
  logSyncOperation, 
  logSyncOperationBatch, 
  logSyncWarning 
};

/**
 * Parses quantity from a caption using multiple pattern matching strategies
 * @param caption The caption text to parse
 * @returns The extracted quantity value and pattern used, or null if no quantity found
 */
export function parseQuantity(caption: string): { value: number; pattern: string } | null {
  if (!caption) return null;

  // Look for patterns like "x2", "x 2", "qty: 2", "quantity: 2"
  const patterns = [
    { regex: /qty:\s*(\d+)/i, name: 'qty-prefix' },               // qty: 2
    { regex: /quantity:\s*(\d+)/i, name: 'quantity-prefix' },     // quantity: 2
    { regex: /(\d+)\s*(?:pcs|pieces)/i, name: 'pcs-suffix' },     // 2 pcs or 2 pieces
    { regex: /(\d+)\s*(?:units?)/i, name: 'units-suffix' },       // 2 unit or 2 units
    { regex: /^.*?#.*?(?:\s+|$)(\d+)(?:\s|$)/i, name: 'after-code' }, // number after product code
    { regex: /(\d+)\s*(?=\s|$)/, name: 'standalone' },            // standalone number
    { regex: /x\s*(\d+)/i, name: 'x-prefix' },                    // x2 or x 2 (moved to end)
    { regex: /(\d+)x/i, name: 'x-suffix' }                        // 18x (new pattern)
  ];

  for (const { regex, name } of patterns) {
    const match = caption.match(regex);
    if (match && match[1]) {
      const quantity = parseInt(match[1], 10);
      if (!isNaN(quantity) && quantity > 0 && quantity < 10000) {
        return { value: quantity, pattern: name };
      }
    }
  }

  return null;
}
