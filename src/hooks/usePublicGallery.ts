
import { useEffect } from 'react';
import { Message } from '@/types';
import { useGalleryData } from './publicGallery/useGalleryData';
import { useGalleryFilters } from './publicGallery/useGalleryFilters';
import { useGalleryPagination } from './publicGallery/useGalleryPagination';

interface UsePublicGalleryProps {
  itemsPerPage?: number;
  initialFilter?: string;
  initialVendorFilter?: string[];
  initialDateField?: 'purchase_date' | 'created_at';
  initialSortOrder?: 'asc' | 'desc';
}

export function usePublicGallery({
  itemsPerPage = 16,
  initialFilter = 'all',
  initialVendorFilter = [],
  initialDateField = 'created_at',
  initialSortOrder = 'desc'
}: UsePublicGalleryProps = {}) {
  const [vendorFilter, setVendorFilter] = useState<string[]>(initialVendorFilter);
  const [dateField, setDateField] = useState<'purchase_date' | 'created_at'>(initialDateField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  // Use our separate hooks
  const { 
    messages, 
    isLoading, 
    isLoadingMore, 
    hasMoreItems, 
    vendors, 
    fetchMessages, 
    deleteMessage 
  } = useGalleryData({
    itemsPerPage,
    vendorFilter,
    dateField,
    sortOrder
  });

  const {
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    filteredMessages,
    mediaGroups
  } = useGalleryFilters({
    messages,
    initialFilter
  });

  const {
    currentPage,
    loadMore,
    resetPagination
  } = useGalleryPagination({
    fetchMessages
  });

  // Reset page when filter changes
  useEffect(() => {
    resetPagination();
  }, [filter, vendorFilter, dateField, sortOrder, resetPagination]);

  return {
    // Data
    messages,
    filteredMessages,
    mediaGroups,
    vendors,
    
    // Loading states
    isLoading,
    isLoadingMore,
    hasMoreItems,
    
    // Filter controls
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    vendorFilter,
    setVendorFilter,
    dateField,
    setDateField,
    sortOrder,
    setSortOrder,
    
    // Pagination
    currentPage,
    loadMore,
    
    // Operations
    fetchMessages,
    deleteMessage
  };
}

// Missing import
import { useState } from 'react';
