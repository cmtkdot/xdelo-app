
/**
 * Interface for media item props used in UI components
 */
export interface MediaItemProps {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'unknown';
  thumbnail?: string;
  title?: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

/**
 * Convert a MediaItemProps to a MediaItemProps with default type and title
 */
export function createMediaItem(
  props: Partial<MediaItemProps> & { url: string }
): MediaItemProps {
  return {
    id: props.id || Math.random().toString(36).substring(2, 9),
    url: props.url,
    type: props.type || 'image',
    thumbnail: props.thumbnail,
    title: props.title || 'Media item',
    description: props.description,
    mimeType: props.mimeType,
    fileSize: props.fileSize,
    width: props.width,
    height: props.height,
    duration: props.duration
  };
}
