
import { Message } from '@/types/entities/Message';
import { MediaItem } from '@/types/ui/MediaViewer';
import { getMediaType, getMainMediaFromGroup, getTelegramMessageUrl } from '../types';

/**
 * Converts a Message to a MediaItem for the viewer
 */
export function messageToMediaItem(message: Message): MediaItem {
  if (!message) return null;
  
  const type = getMediaType(message.mime_type);
  
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || '',
    file_unique_id: message.file_unique_id || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content,
    caption: message.caption,
    width: message.width,
    height: message.height,
    file_size: message.file_size,
    duration: message.duration,
    content_disposition: message.content_disposition,
    storage_path: message.storage_path,
    processing_state: message.processing_state,
    type
  };
}

// Re-export utility functions for backward compatibility
export { 
  getMainMediaFromGroup, 
  getTelegramMessageUrl,
  getMediaType
};
