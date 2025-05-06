
import { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types/MessagesTypes';
import { debounce } from 'lodash';

interface UsePublicGallerySearchProps {
  messages: Message[];
  debounceTime?: number;
}

export const usePublicGallerySearch = ({ 
  messages, 
  debounceTime = 300 
}: UsePublicGallerySearchProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>(messages);
  const [isSearching, setIsSearching] = useState(false);

  // Apply search filter to messages
  const filterMessages = useCallback((term: string, messagesArray: Message[]) => {
    if (!term.trim()) {
      return messagesArray;
    }

    const lowerTerm = term.toLowerCase().trim();
    return messagesArray.filter(message => {
      const content = message.analyzed_content;
      
      // Check product name
      if (content?.product_name && 
          content.product_name.toLowerCase().includes(lowerTerm)) {
        return true;
      }
      
      // Check product code
      if (content?.product_code && 
          content.product_code.toLowerCase().includes(lowerTerm)) {
        return true;
      }
      
      // Check vendor UID
      if (content?.vendor_uid && 
          content.vendor_uid.toLowerCase().includes(lowerTerm)) {
        return true;
      }
      
      // Check notes
      if (content?.notes && 
          content.notes.toLowerCase().includes(lowerTerm)) {
        return true;
      }
      
      // Check caption field
      if (content?.caption && 
          content.caption.toLowerCase().includes(lowerTerm)) {
        return true;
      }
      
      // Check message caption
      if (message.caption && 
          message.caption.toLowerCase().includes(lowerTerm)) {
        return true;
      }
      
      return false;
    });
  }, []);

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((term: string, messagesArray: Message[]) => {
      setIsSearching(true);
      const results = filterMessages(term, messagesArray);
      setFilteredMessages(results);
      setIsSearching(false);
    }, debounceTime),
    [filterMessages, debounceTime]
  );

  // Handle search term changes
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setIsSearching(true);
    debouncedSearch(term, messages);
  }, [debouncedSearch, messages]);

  // Reset search when messages change
  useEffect(() => {
    if (searchTerm.trim()) {
      debouncedSearch(searchTerm, messages);
    } else {
      setFilteredMessages(messages);
    }
  }, [messages, searchTerm, debouncedSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setFilteredMessages(messages);
    setIsSearching(false);
  }, [messages]);

  return {
    searchTerm,
    filteredMessages,
    isSearching,
    handleSearch,
    clearSearch
  };
};
