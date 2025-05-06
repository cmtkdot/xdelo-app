
import { useState, useCallback } from 'react';

interface UseGalleryPaginationProps {
  fetchMessages: (page: number, append: boolean) => Promise<void>;
}

export function useGalleryPagination({ 
  fetchMessages 
}: UseGalleryPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchMessages(nextPage, true);
  }, [currentPage, fetchMessages]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    setCurrentPage,
    loadMore,
    resetPagination
  };
}
