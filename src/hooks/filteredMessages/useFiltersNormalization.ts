
import { useCallback } from 'react';
import { ProcessingState } from '@/types';

export interface NormalizedFilters {
  processingStates: ProcessingState[];
  search: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  dateRange: { from: Date, to: Date } | null;
  mediaTypes: string[];
  vendors: string[];
  chatSources: string[];
  page: number;
  itemsPerPage: number;
  view: 'grid' | 'list';
}

export function useFiltersNormalization() {
  const normalizeFilters = useCallback((filters: any): NormalizedFilters => {
    return {
      processingStates: filters.processingStates || [],
      search: filters.search || '',
      sortField: filters.sortField || 'created_at',
      sortOrder: filters.sortOrder || 'desc',
      dateRange: filters.dateRange || null,
      mediaTypes: filters.mediaTypes || [],
      vendors: filters.vendors || [],
      chatSources: filters.chatSources || [],
      page: filters.page || 1,
      itemsPerPage: filters.itemsPerPage || 20,
      view: filters.view || 'grid'
    };
  }, []);

  return { normalizeFilters };
}
