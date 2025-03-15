
// Legacy type file - redirecting to the new location
// Import from '@/types/ui/MediaItem' instead

import { MediaItem as NewMediaItem } from './ui/MediaItem';

export type MediaItem = NewMediaItem;

// Re-export getMediaType for backward compatibility
export { getMediaType } from './ui/MediaItem';
