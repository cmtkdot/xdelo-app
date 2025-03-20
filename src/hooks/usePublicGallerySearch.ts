
import { useState, useEffect, useMemo } from 'react';
import { Message } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';

interface UsePublicGallerySearchProps {
  messages: Message[];
  debounceTime?: number;
}

export function usePublicGallerySearch({ 
  messages, 
  debounceTime = 300 
}: UsePublicGallerySearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, debounceTime);
  
  // Reset search state when messages change
  useEffect(() => {
    setIsSearching(false);
  }, [messages]);
  
  // Set searching state while debouncing
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchTerm, debouncedSearchTerm]);
  
  // Filter messages based on search term
  const filteredMessages = useMemo(() => {
    if (!debouncedSearchTerm) return messages;
    
    setIsSearching(true);
    
    try {
      const searchLowerCase = debouncedSearchTerm.toLowerCase();
      
      const results = messages.filter(message => {
        // Search in caption
        if (message.caption && message.caption.toLowerCase().includes(searchLowerCase)) {
          return true;
        }
        
        // Search in analyzed_content if available
        if (message.analyzed_content) {
          const content = message.analyzed_content as any;
          if (content.product_name && content.product_name.toLowerCase().includes(searchLowerCase)) {
            return true;
          }
          if (content.vendor_uid && content.vendor_uid.toLowerCase().includes(searchLowerCase)) {
            return true;
          }
          if (content.product_code && content.product_code.toLowerCase().includes(searchLowerCase)) {
            return true;
          }
          if (content.notes && content.notes.toLowerCase().includes(searchLowerCase)) {
            return true;
          }
        }
        
        return false;
      });
      
      return results;
    } finally {
      setIsSearching(false);
    }
  }, [messages, debouncedSearchTerm]);
  
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      setIsSearching(true);
    }
  };
  
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
