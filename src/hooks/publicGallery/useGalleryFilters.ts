
import { useState, useEffect, useMemo } from 'react';
import { Message } from '@/types';

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
      result = result.filter(m => m.mime_type?.startsWith('video/'));
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
