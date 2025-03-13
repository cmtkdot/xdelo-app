
import { MediaItem } from '@/types';
import { Message } from '@/types/entities/Message';

/**
 * Converts a Message to a MediaItem for use in components
 */
export function messageToMediaItem(message: Message): MediaItem {
  if (!message) return null;
  
  // Determine the media type based on MIME type
  let type: 'image' | 'video' | 'document' | 'audio' | 'unknown' = 'unknown';
  const mimeType = message.mime_type || '';
  
  if (mimeType.startsWith('image/')) {
    type = 'image';
  } else if (mimeType.startsWith('video/')) {
    type = 'video';
  } else if (mimeType.startsWith('audio/')) {
    type = 'audio';
  } else if (mimeType.startsWith('application/')) {
    type = 'document';
  }
  
  // Get title from either analyzed_content or caption
  const title = message.analyzed_content?.product_name || message.caption || 'Untitled';
  
  return {
    // Core properties with the new naming convention
    id: message.id,
    url: message.public_url || '',
    type,
    
    // Standard properties
    thumbnail: type === 'image' ? message.public_url : undefined,
    width: message.width,
    height: message.height,
    title,
    description: message.caption,
    mimeType: message.mime_type,
    fileSize: message.file_size,
    duration: message.duration,
    uploadedAt: message.created_at,
    
    // Legacy properties for backward compatibility
    public_url: message.public_url,
    mime_type: message.mime_type,
    file_unique_id: message.file_unique_id,
    analyzed_content: message.analyzed_content,
    created_at: message.created_at,
    caption: message.caption,
    content_disposition: message.content_disposition,
    storage_path: message.storage_path,
    processing_state: message.processing_state
  };
}

/**
 * Takes an array of Message objects and converts them to MediaItem objects
 */
export function messagesToMediaItems(messages: Message[]): MediaItem[] {
  if (!messages || !Array.isArray(messages)) return [];
  return messages.map(messageToMediaItem);
}
