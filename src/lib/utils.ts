
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
    url: message.public_url || '',
    type: message.mime_type?.startsWith('video/') ? 'video' : 'image',
    caption: message.caption || '',
    width: message.width || 0,
    height: message.height || 0,
    public_url: message.public_url || '',
    created_at: message.created_at || new Date().toISOString()
  };
};

// Re-export other utilities
export * from './generalUtils';
// Explicitly re-export specific functions from productMatching to avoid conflicts
import { 
  matchProduct,
  updateProduct,
  // exclude logSyncOperation to avoid duplicate export
} from './productMatching';
export { matchProduct, updateProduct };
export * from './syncUtils';
