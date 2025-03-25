
import { useEnhancedMessagesData, UseEnhancedMessagesDataOptions } from './useEnhancedMessagesData';
import { useRealtimeMessages } from './useRealtimeMessages';

export interface UseEnhancedMessagesOptions extends UseEnhancedMessagesDataOptions {
  enableRealtime?: boolean;
}

/**
 * Main hook that combines data fetching and realtime updates
 */
export function useEnhancedMessages(options: UseEnhancedMessagesOptions = {}) {
  const { enableRealtime = true, ...dataOptions } = options;
  
  const { 
    data: messages,
    isLoading,
    isRefetching,
    error,
    refetch
  } = useEnhancedMessagesData(dataOptions);
  
  const {
    realtimeEnabled,
    toggleRealtime
  } = useRealtimeMessages(enableRealtime);
  
  return {
    messages: messages?.flatMessages || [],
    groupedMessages: messages?.groupedMessages || [],
    isLoading,
    isRefetching,
    error,
    refetch,
    realtimeEnabled,
    toggleRealtime
  };
}
