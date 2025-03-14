
import { useMemo } from 'react';
import { Message } from '@/types';
import { useEnhancedMessages } from './useEnhancedMessages';
import { useMessagesStore } from './useMessagesStore';

export function useFilteredMessages() {
  const { filters } = useMessagesStore();
  
  // Fetch messages with the filters applied
  const { 
    groupedMessages: mediaGroups, 
    isLoading, 
    error, 
    refetch,
    isRefetching
  } = useEnhancedMessages({
    grouped: true,
    limit: 500,
    processingStates: filters.processingStates,
    searchTerm: filters.search,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder
  });
  
  // Apply additional client-side filtering
  const filteredMessages = useMemo(() => {
    // Defensive check
    if (!Array.isArray(mediaGroups)) {
      console.warn('mediaGroups is not an array in filteredMessages', mediaGroups);
      return [] as Message[][];
    }
    
    try {
      return mediaGroups.filter(group => {
        // Skip invalid groups
        if (!group || !Array.isArray(group) || group.length === 0) {
          return false;
        }
        
        const mainMessage = group[0];
        if (!mainMessage) return false;

        // Additional filtering beyond what useEnhancedMessages provides
        if (filters.dateRange) {
          const messageDate = new Date(mainMessage.created_at || '');
          if (messageDate < filters.dateRange.from || messageDate > filters.dateRange.to) {
            return false;
          }
        }
        
        if (filters.mediaTypes.length > 0) {
          const mediaType = mainMessage.mime_type?.split('/')[0] || 'unknown';
          if (!filters.mediaTypes.includes(mediaType)) {
            return false;
          }
        }
        
        if (filters.vendors.length > 0) {
          const vendor = mainMessage.analyzed_content?.vendor_uid;
          if (!vendor || !filters.vendors.includes(vendor)) {
            return false;
          }
        }
        
        if (filters.chatSources.length > 0) {
          const chatSource = `${mainMessage.chat_id}-${mainMessage.chat_type}`;
          if (!filters.chatSources.includes(chatSource)) {
            return false;
          }
        }
        
        return true;
      });
    } catch (err) {
      console.error('Error in filtering messages:', err);
      return [] as Message[][];
    }
  }, [mediaGroups, filters]);

  // Paginate the filtered messages
  const paginatedMessages = useMemo(() => {
    // Defensive programming - ensure filteredMessages is valid
    if (!filteredMessages || !Array.isArray(filteredMessages)) {
      console.warn('filteredMessages is not an array in pagination', filteredMessages);
      return [] as Message[][];
    }
    
    if (filteredMessages.length === 0) {
      return [] as Message[][];
    }
    
    const startIndex = (filters.page - 1) * filters.itemsPerPage;
    return filteredMessages.slice(startIndex, startIndex + filters.itemsPerPage);
  }, [filteredMessages, filters.page, filters.itemsPerPage]);

  return {
    filteredMessages,
    paginatedMessages,
    isLoading,
    error,
    refetch,
    isRefetching,
    total: filteredMessages.length
  };
}
