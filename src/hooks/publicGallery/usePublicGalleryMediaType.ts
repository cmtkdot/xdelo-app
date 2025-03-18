
import { useState, useCallback } from 'react';
import { Message } from '@/types/MessagesTypes';

type MediaTypeFilter = 'all' | 'images' | 'videos';

interface UsePublicGalleryMediaTypeProps {
  messages: Message[];
}

export const usePublicGalleryMediaType = ({ 
  messages 
}: UsePublicGalleryMediaTypeProps) => {
  const [mediaType, setMediaType] = useState<MediaTypeFilter>('all');
  
  // Filter messages by media type
  const filteredMessages = useCallback(() => {
    if (mediaType === 'all') {
      return messages;
    } else if (mediaType === 'images') {
      return messages.filter(m => m.mime_type?.startsWith('image/'));
    } else if (mediaType === 'videos') {
      return messages.filter(m => m.mime_type?.startsWith('video/'));
    }
    return messages;
  }, [messages, mediaType]);

  return {
    mediaType,
    setMediaType,
    filteredMessages: filteredMessages()
  };
};
