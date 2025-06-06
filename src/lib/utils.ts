import { Message } from "@/types/entities/Message";
import { AnalyzedContent } from "@/types/utils/AnalyzedContent";
import { MediaItem } from "@/types/entities/MediaItem";

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
  // Determine media type from mime_type
  let type: 'image' | 'video' | 'document' | 'audio' | 'unknown' = 'unknown';
  
  if (message.mime_type) {
    if (message.mime_type.startsWith('image/')) {
      type = 'image';
    } else if (message.mime_type.startsWith('video/')) {
      type = 'video';
    } else if (message.mime_type.startsWith('audio/')) {
      type = 'audio';
    } else if (message.mime_type.startsWith('application/')) {
      type = 'document';
    }
  }
  
  return {
    id: message.id,
    public_url: message.public_url || '',
    type: type,
    thumbnail: type === 'image' ? message.public_url : undefined,
    width: message.width,
    height: message.height,
    title: message.analyzed_content?.product_name || message.caption,
    description: message.caption,
    mimeType: message.mime_type,
    fileSize: message.file_size,
    duration: message.duration,
    uploadedAt: message.created_at,
    // Include legacy fields for compatibility
    mime_type: message.mime_type,
    file_unique_id: message.file_unique_id,
    analyzed_content: message.analyzed_content,
    created_at: message.created_at,
    caption: message.caption,
    file_size: message.file_size,
    content_disposition: message.content_disposition,
    storage_path: message.storage_path,
    processing_state: message.processing_state
  };
};

/**
 * Helper function to determine media type from MIME type
 */
function getMediaType(mimeType: string): 'image' | 'video' | 'document' | 'audio' | 'unknown' {
  if (!mimeType) return 'unknown';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/')) return 'document';
  
  return 'unknown';
}

// Export from generalUtils
export { cn } from './generalUtils';



// Export from logUtils
import { logEvent, LogEventType } from './logUtils';
export { logEvent, LogEventType };

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
