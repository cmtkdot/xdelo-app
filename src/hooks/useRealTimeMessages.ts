
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message, ProcessingState } from '@/types';

// Define FilterOptions interface here since it's not in types.ts
interface FilterOptions {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: 'asc' | 'desc';
  sortField?: string;
  chatId?: number;
  vendorId?: string;
  mediaGroupId?: string;
  processingStates?: ProcessingState[];
  startDate?: string;
  endDate?: string;
  hasCaption?: boolean;
  excludeForwarded?: boolean;
  excludeEdited?: boolean;
  hasError?: boolean;
  hasMediaGroup?: boolean;
  needsRedownload?: boolean;
  fileUniqueId?: string;
  [key: string]: any;
}

export function useRealTimeMessages(options: FilterOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const {
    limit = 30,
    offset = 0,
    search = '',
    sort = 'desc',
    sortField = 'created_at',
    chatId,
    vendorId,
    mediaGroupId,
    processingStates,
    startDate,
    endDate,
    hasCaption,
    excludeForwarded,
    excludeEdited,
    hasError,
    hasMediaGroup,
    needsRedownload,
    fileUniqueId,
    ...otherOptions
  } = options;
  
  // Simplify the query key to avoid excessive depth
  const queryKey = [
    'messages',
    JSON.stringify({
      limit,
      offset,
      search,
      sort,
      sortField,
      chatId,
      vendorId,
      mediaGroupId,
      processingStates: processingStates ? processingStates.join(',') : null,
      startDate,
      endDate,
      hasCaption,
      excludeForwarded,
      excludeEdited,
      hasError,
      hasMediaGroup,
      needsRedownload,
      fileUniqueId,
      ...otherOptions
    })
  ];

  // Include the actual processing states in the filter
  // Use 'as const' to make it a readonly tuple to match the expected type
  const validProcessingStates = ['initialized', 'pending', 'processing', 'completed', 'error', 'partial_success'] as const;
  const stateFilterParam = processingStates || validProcessingStates;

  // Query to fetch messages
  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('messages')
        .select('*');
      
      // Apply all filters
      if (search) {
        query = query.or(`caption.ilike.%${search}%,analyzed_content->vendor_uid.ilike.%${search}%,analyzed_content->product_name.ilike.%${search}%,analyzed_content->product_code.ilike.%${search}%`);
      }
      
      if (chatId) {
        query = query.eq('chat_id', chatId);
      }
      
      if (vendorId) {
        query = query.eq('analyzed_content->vendor_uid', vendorId);
      }
      
      if (mediaGroupId) {
        query = query.eq('media_group_id', mediaGroupId);
      }
      
      if (stateFilterParam.length > 0 && stateFilterParam.length < 6) {
        query = query.in('processing_state', stateFilterParam);
      }
      
      if (hasCaption !== undefined) {
        if (hasCaption) {
          query = query.not('caption', 'is', null);
        } else {
          query = query.is('caption', null);
        }
      }
      
      if (excludeForwarded) {
        query = query.eq('is_forward', false);
      }
      
      if (excludeEdited) {
        query = query.eq('is_edited', false);
      }
      
      if (hasError !== undefined) {
        if (hasError) {
          query = query.not('error_message', 'is', null);
        } else {
          query = query.is('error_message', null);
        }
      }
      
      if (hasMediaGroup !== undefined) {
        if (hasMediaGroup) {
          query = query.not('media_group_id', 'is', null);
        } else {
          query = query.is('media_group_id', null);
        }
      }
      
      if (needsRedownload !== undefined) {
        query = query.eq('needs_redownload', needsRedownload);
      }
      
      if (fileUniqueId) {
        query = query.eq('file_unique_id', fileUniqueId);
      }
      
      if (startDate && endDate) {
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      } else if (startDate) {
        query = query.gte('created_at', startDate);
      } else if (endDate) {
        query = query.lte('created_at', endDate);
      }
      
      // Add sorting and pagination
      query = query.order(sortField, { ascending: sort === 'asc' }).limit(limit).range(offset, offset + limit - 1);
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
      
      return data as Message[];
    }
  });

  // Handle data update when query data changes
  useEffect(() => {
    if (data) {
      setMessages(data);
    }
  }, [data]);

  // Set up real-time channel
  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        console.log('Realtime update received:', payload);
        
        // Only refetch when a message that matches our criteria changes
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, queryKey.join()]);

  // Add a function to manually refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing messages:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    messages,
    isLoading,
    error,
    refetch,
    isRefreshing,
    lastRefresh,
    handleRefresh
  };
}
