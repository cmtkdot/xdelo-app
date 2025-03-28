
import { useMemo } from 'react';
import { Message } from '@/types';
import { NormalizedFilters } from './useFiltersNormalization';

export function useClientSideFiltering(groupedMessages: Message[][] = [], filters: NormalizedFilters) {
  const filteredMessages = useMemo(() => {
    if (!Array.isArray(groupedMessages)) {
      return [];
    }
    
    return groupedMessages.filter(group => {
      // Skip invalid groups
      if (!group || !Array.isArray(group) || group.length === 0) {
        return false;
      }
      
      const mainMessage = group[0];
      if (!mainMessage) return false;

      // Date range filtering
      if (filters.dateRange?.from && filters.dateRange?.to) {
        const messageDate = new Date(mainMessage.created_at || '');
        if (messageDate < filters.dateRange.from || messageDate > filters.dateRange.to) {
          return false;
        }
      }
      
      // Media type filtering
      if (filters.mediaTypes && filters.mediaTypes.length > 0) {
        if (!mainMessage.mime_type) return false;
        
        // Extract the main type from MIME type (e.g., "image/jpeg" -> "image")
        const mainType = mainMessage.mime_type.split('/')[0];
        if (!filters.mediaTypes.includes(mainType)) {
          return false;
        }
      }
      
      // Vendor filtering
      if (filters.vendors && filters.vendors.length > 0) {
        const vendor = mainMessage.analyzed_content?.vendor_uid;
        if (!vendor || !filters.vendors.includes(vendor)) {
          return false;
        }
      }
      
      // Chat source filtering
      if (filters.chatSources && filters.chatSources.length > 0) {
        const chatSource = `${mainMessage.chat_id}-${mainMessage.chat_type}`;
        if (!filters.chatSources.includes(chatSource)) {
          return false;
        }
      }
      
      return true;
    });
  }, [groupedMessages, filters]);

  return { filteredMessages };
}
