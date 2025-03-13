
import type { Message } from "@/types/entities/Message";
import type { MediaItem } from "@/types/ui/MediaViewer";

export function messageToMediaItem(message: Message): MediaItem {
  // Set default mime_type based on file extension if not provided
  let mimeType = message.mime_type;
  if (!mimeType && message.public_url) {
    const extension = message.public_url.split('.').pop()?.toLowerCase();
    if (extension) {
      switch (extension) {
        case 'jpg':
        case 'jpeg':
          mimeType = 'image/jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        case 'mp4':
          mimeType = 'video/mp4';
          break;
        case 'webm':
          mimeType = 'video/webm';
          break;
        default:
          // Default to binary if unknown
          mimeType = 'application/octet-stream';
      }
    }
  }

  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: mimeType || '',
    file_unique_id: message.file_unique_id || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content || undefined,
    caption: message.caption,
    width: message.width,
    height: message.height,
    file_size: message.file_size,
    duration: message.duration,
    content_disposition: message.content_disposition,
    storage_path: message.storage_path,
    processing_state: message.processing_state
  };
}

// Function to validate media group consistency
export function validateMediaGroup(messages: Message[]): boolean {
  if (!messages || messages.length === 0) return false;
  
  // Check if all messages have the same media_group_id
  const firstGroupId = messages[0].media_group_id;
  if (!firstGroupId) return false;
  
  return messages.every(message => message.media_group_id === firstGroupId);
}

// Get best representation for a media group
export function getMainMediaFromGroup(messages: Message[]): Message | null {
  if (!messages || messages.length === 0) return null;
  
  // First, try to find message with original caption
  const originalCaption = messages.find(m => m.is_original_caption === true);
  if (originalCaption) return originalCaption;
  
  // Then, try to find any message with caption
  const withCaption = messages.find(m => !!m.caption);
  if (withCaption) return withCaption;
  
  // Finally, just return the first message as fallback
  return messages[0];
}
