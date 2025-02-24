
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
export * from './syncUtils';

// Export everything from productMatching except logSyncOperation
export * from './productMatching';
