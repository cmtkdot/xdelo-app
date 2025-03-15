
import { Message } from '@/types';
import { MediaItem, getMediaType } from '@/types/ui/MediaViewer';
import { 
  messageToMediaItem, 
  getMainMediaFromGroup, 
  getTelegramMessageUrl 
} from '@/lib/mediaUtils';

// Re-export the utility functions from our consolidated location
export { 
  messageToMediaItem, 
  getMainMediaFromGroup, 
  getTelegramMessageUrl,
  getMediaType 
};
