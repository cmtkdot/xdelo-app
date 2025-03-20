
import { useState, useEffect, useMemo } from 'react';
import { Message } from '@/types';
import { filterMessagesBySearchTerm } from '@/lib/publicGallery/searchUtils';

interface UsePublicGalleryCustomSearchProps {
  messages: Message[];
  initialTerm?: string;
}

export function usePublicGalleryCustomSearch({ 
  messages = [], 
  initialTerm = '' 
}: UsePublicGalleryCustomSearchProps) {
  const [searchTerm, setSearchTerm] = useState(initialTerm);
  const [isSearching, setIsSearching] = useState(false);
  
  // Filter messages by search term
  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    return filterMessagesBySearchTerm(messages, searchTerm);
  }, [messages, searchTerm]);
  
  // Handle search change
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setIsSearching(!!term.trim());
  };
  
  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setIsSearching(false);
  };
  
  return {
    searchTerm,
    filteredMessages,
    isSearching,
    handleSearch,
    clearSearch
  };
}
