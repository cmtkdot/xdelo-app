
import { useMemo } from 'react';
import { useEnhancedMessages } from '../enhancedMessages';
import { useMessagesStore } from '../useMessagesStore';
import { useClientSideFiltering } from './useClientSideFiltering';
import { useFiltersNormalization } from './useFiltersNormalization';

export function useFilteredMessages() {
  const { filters } = useMessagesStore();
  const { normalizeFilters } = useFiltersNormalization();

  // Normalize the filters
  const safeFilters = normalizeFilters(filters);

  // Fetch messages with the base filters applied via API
  const {
    groupedMessages = [],
    isLoading = false,
    error = null,
    refetch,
    isRefetching = false
  } = useEnhancedMessages({
    grouped: true,
    limit: 500, // Increased limit to ensure we have enough data after client-side filtering
    processingStates: safeFilters.processingStates,
    searchTerm: safeFilters.search,
    sortBy: safeFilters.sortField as any,
    sortOrder: safeFilters.sortOrder
  });

  // Apply additional client-side filtering
  const { filteredMessages } = useClientSideFiltering(groupedMessages, safeFilters);

  // Paginate the filtered messages
  const paginatedMessages = useMemo(() => {
    if (!filteredMessages || !Array.isArray(filteredMessages) || filteredMessages.length === 0) {
      return [];
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
