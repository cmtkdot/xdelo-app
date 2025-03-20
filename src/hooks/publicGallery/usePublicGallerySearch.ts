
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '../useDebounce';

export function usePublicGallerySearch(initialQuery = '', limit = 20) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  const [filters, setFilters] = useState<{
    [key: string]: string | boolean | null;
  }>({
    vendorUid: null,
    dateRange: null,
    sort: 'newest',
  });
  
  const debouncedQuery = useDebounce(query, 300);
  
  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Start with the base query
      let dbQuery = supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('deleted_from_telegram', false)
        .not('analyzed_content', 'is', null);
      
      // Apply the search query if provided
      if (debouncedQuery) {
        dbQuery = dbQuery.or(
          `caption.ilike.%${debouncedQuery}%,analyzed_content->product_name.ilike.%${debouncedQuery}%,analyzed_content->product_code.ilike.%${debouncedQuery}%`
        );
      }
      
      // Apply vendor filter
      if (filters.vendorUid && typeof filters.vendorUid === 'string') {
        dbQuery = dbQuery.eq('analyzed_content->>vendor_uid', filters.vendorUid);
      }
      
      // Apply date range filter
      if (filters.dateRange) {
        const today = new Date();
        let startDate;
        
        if (filters.dateRange === '7days') {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
        } else if (filters.dateRange === '30days') {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 30);
        } else if (filters.dateRange === '90days') {
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 90);
        }
        
        if (startDate) {
          dbQuery = dbQuery.gte('created_at', startDate.toISOString());
        }
      }
      
      // Apply sorting
      if (filters.sort === 'newest') {
        dbQuery = dbQuery.order('created_at', { ascending: false });
      } else if (filters.sort === 'oldest') {
        dbQuery = dbQuery.order('created_at', { ascending: true });
      }
      
      // Calculate pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      // Execute the query with pagination
      const { data, count: totalCount, error: queryError } = await dbQuery.range(from, to);
      
      if (queryError) {
        throw queryError;
      }
      
      setResults(data || []);
      setCount(totalCount || 0);
      setHasMore(totalCount ? from + data.length < totalCount : false);
    } catch (err) {
      setError(err.message || 'An error occurred while searching');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filters, page, limit]);
  
  // Trigger search when debounced query or filters change
  useEffect(() => {
    search();
  }, [search]);
  
  // Reset page when query or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filters]);
  
  return {
    query,
    setQuery,
    results,
    loading,
    error,
    count,
    page,
    setPage,
    hasMore,
    filters,
    setFilters,
    search, // Exposed for manual refresh
  };
}
