
import { useMemo } from 'react';
import { Message } from '@/types';
import { useEnhancedMessages } from './useEnhancedMessages';
import { useMessagesStore } from './useMessagesStore';

export function useFilteredMessages() {
  const messagesStore = useMessagesStore();
  const filters = messagesStore?.filters || {
    processingStates: [],
    search: '',
    sortField: 'created_at',
    sortOrder: 'desc',
    dateRange: null,
    mediaTypes: [],
    vendors: [],
    chatSources: [],
    page: 1,
    itemsPerPage: 20
  };
  
  // Ensure filters is properly initialized with default values
  const safeFilters = {
    processingStates: filters.processingStates || [],
    search: filters.search || '',
    sortField: filters.sortField || 'created_at',
    sortOrder: filters.sortOrder || 'desc',
    dateRange: filters.dateRange || null,
    mediaTypes: filters.mediaTypes || [],
    vendors: filters.vendors || [],
    chatSources: filters.chatSources || [],
    page: filters.page || 1,
    itemsPerPage: filters.itemsPerPage || 20
  };
  
  // Fetch messages with the base filters applied via API
  const { 
    groupedMessages: mediaGroups = [], 
    isLoading = false, 
    error = null, 
    refetch,
    isRefetching = false
  } = useEnhancedMessages({
    grouped: true,
    limit: 500,
    processingStates: safeFilters.processingStates,
    searchTerm: safeFilters.search,
    sortBy: safeFilters.sortField,
    sortOrder: safeFilters.sortOrder
  }) || {};
  
  // Apply additional client-side filtering that can't be done in the initial query
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

        // Date range filtering
        if (safeFilters.dateRange?.from && safeFilters.dateRange?.to) {
          const messageDate = new Date(mainMessage.created_at || '');
          if (messageDate < safeFilters.dateRange.from || messageDate > safeFilters.dateRange.to) {
            return false;
          }
        }
        
        // Media type filtering
        if (safeFilters.mediaTypes && safeFilters.mediaTypes.length > 0) {
          if (!mainMessage.mime_type) return false;
          
          // Extract the main type from MIME type (e.g., "image/jpeg" -> "image")
          const mainType = mainMessage.mime_type.split('/')[0];
          if (!safeFilters.mediaTypes.includes(mainType)) {
            return false;
          }
        }
        
        // Vendor filtering
        if (safeFilters.vendors && safeFilters.vendors.length > 0) {
          const vendor = mainMessage.analyzed_content?.vendor_uid;
          if (!vendor || !safeFilters.vendors.includes(vendor)) {
            return false;
          }
        }
        
        // Chat source filtering
        if (safeFilters.chatSources && safeFilters.chatSources.length > 0) {
          const chatSource = `${mainMessage.chat_id}-${mainMessage.chat_type}`;
          if (!safeFilters.chatSources.includes(chatSource)) {
            return false;
          }
        }
        
        return true;
      });
    } catch (err) {
      console.error('Error in filtering messages:', err);
      return [] as Message[][];
    }
  }, [mediaGroups, safeFilters]);

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
    
    const startIndex = (safeFilters.page - 1) * safeFilters.itemsPerPage;
    return filteredMessages.slice(startIndex, startIndex + safeFilters.itemsPerPage);
  }, [filteredMessages, safeFilters.page, safeFilters.itemsPerPage]);

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
