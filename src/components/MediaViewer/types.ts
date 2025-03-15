
// This file is now deprecated - import from '@/types/ui/MediaItem' instead
import { Message } from '@/types';
import { 
  messageToMediaItem, 
  getMainMediaFromGroup, 
  getTelegramMessageUrl,
  getMediaType 
} from '@/lib/mediaUtils';

// Re-export the utility functions from our consolidated location
export { 
  messageToMediaItem, 
  getMainMediaFromGroup, 
  getTelegramMessageUrl,
  getMediaType 
};
