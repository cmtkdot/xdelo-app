
import { useEnhancedMessages } from './useEnhancedMessages';
import { Message } from '@/types';

export function useMediaGroups() {
  // Use the new hook with grouped=true to maintain backward compatibility
  const { 
    groupedMessages,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useEnhancedMessages({
    grouped: true,
    limit: 500
  });
  
  return {
    data: groupedMessages as Message[][],
    isLoading,
    error,
    refetch,
    isRefetching
  };
}
