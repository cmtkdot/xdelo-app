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

/**
 * Parses quantity from a caption using multiple pattern matching strategies
 * @param caption The caption text to parse
 * @returns The extracted quantity value and pattern used, or null if no quantity found
 */
export function parseQuantity(caption: string): { value: number; pattern: string } | null {
  if (!caption) return null;

  // Look for patterns like "x2", "x 2", "qty: 2", "quantity: 2"
  const patterns = [
    { regex: /x\s*(\d+)/i, name: 'x-prefix' },                    // x2 or x 2
    { regex: /qty:\s*(\d+)/i, name: 'qty-prefix' },               // qty: 2
    { regex: /quantity:\s*(\d+)/i, name: 'quantity-prefix' },     // quantity: 2
    { regex: /(\d+)\s*(?:pcs|pieces)/i, name: 'pcs-suffix' },     // 2 pcs or 2 pieces
    { regex: /(\d+)\s*(?:units?)/i, name: 'units-suffix' },       // 2 unit or 2 units
    { regex: /^.*?#.*?(?:\s+|$)(\d+)(?:\s|$)/i, name: 'after-code' }, // number after product code
    { regex: /(\d+)\s*(?=\s|$)/, name: 'standalone' }             // standalone number
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
