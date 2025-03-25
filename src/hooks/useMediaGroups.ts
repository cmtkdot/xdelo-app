
// Legacy wrapper hook that uses the modular implementation under the hood
// This ensures backwards compatibility with existing code
import { useEnhancedMessages } from './enhancedMessages';

export function useMediaGroups() {
  const { 
    groupedMessages: data, 
    isLoading,
    isRefetching,
    error,
    refetch,
    realtimeEnabled,
    toggleRealtime
  } = useEnhancedMessages({
    grouped: true,
    limit: 500
  });

  return {
    data,
    isLoading,
    isRefetching,
    error,
    refetch,
    realtimeEnabled,
    toggleRealtime
  };
}
