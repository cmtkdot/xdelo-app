
import { useState, useMemo } from 'react';
import { Message } from '@/types';
import { isVideoMessage } from '@/utils/mediaUtils';

interface UseGalleryFiltersProps {
  messages: Message[];
  initialFilter?: string;
}

export function useGalleryFilters({
  messages,
  initialFilter = 'all'
}: UseGalleryFiltersProps) {
  const [filter, setFilter] = useState<string>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');

  // Apply filters whenever messages or filter change
  const filteredMessages = useMemo(() => {
    let result = [...messages];
    
    // Apply search filter if search term exists
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(msg => 
        (msg.caption && msg.caption.toLowerCase().includes(term))
      );
    }
    
    // Apply media type filter
    if (filter === "images") {
      result = result.filter(m => m.mime_type?.startsWith('image/'));
    } else if (filter === "videos") {
      // Use the same video detection logic as in PublicMediaCard
      result = result.filter(m => {
        return isVideoMessage(m) || 
          (m.public_url && (
            m.public_url.endsWith('.mp4') || 
            m.public_url.endsWith('.mov') ||
            m.public_url.endsWith('.webm') ||
            m.public_url.endsWith('.avi')
          ));
      });
    }
    
    return result;
  }, [messages, filter, searchTerm]);

  // Group messages by media_group_id
  const mediaGroups = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    
    // Group messages by media_group_id or individually
    filteredMessages.forEach(message => {
      if (message.media_group_id) {
        groups[message.media_group_id] = groups[message.media_group_id] || [];
        groups[message.media_group_id].push(message);
      } else {
        // For messages without a group, use the message ID as a key
        groups[message.id] = [message];
      }
    });
    
    // Convert record to array of arrays
    return Object.values(groups);
  }, [filteredMessages]);

  return {
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    filteredMessages,
    mediaGroups
  };
}
