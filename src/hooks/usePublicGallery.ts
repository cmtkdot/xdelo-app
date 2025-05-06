import { ProcessingState } from "@/types/api/ProcessingState";
import { useEffect, useState } from "react";
import { useGalleryData } from "./useGalleryData";
import { useGalleryFilters } from "./useGalleryFilters";

interface UsePublicGalleryProps {
  itemsPerPage?: number;
}

export function usePublicGallery({
  itemsPerPage = 16,
}: UsePublicGalleryProps = {}) {
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [processingState, setProcessingState] = useState<ProcessingState>(
    "" as ProcessingState
  );
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [dateField, setDateField] = useState<"created_at" | "updated_at">(
    "created_at"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const {
    messages,
    vendors,
    isLoading,
    isLoadingMore,
    hasMoreItems,
    currentPage,
    setPage,
    loadMore,
    fetchMessages,
    deleteMessage,
  } = useGalleryData({
    itemsPerPage,
    vendorFilter,
    searchTerm,
    dateRange,
    dateField,
    sortOrder,
    processingState,
  });

  const { filteredMessages, mediaGroups } = useGalleryFilters({
    messages,
    filter,
  });

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter, vendorFilter, dateRange, dateField, sortOrder, setPage]);

  return {
    messages,
    filteredMessages,
    mediaGroups,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    vendorFilter,
    setVendorFilter,
    vendors,
    dateRange,
    setDateRange,
    dateField,
    setDateField,
    sortOrder,
    setSortOrder,
    processingState,
    setProcessingState,
    isLoading,
    isLoadingMore,
    hasMoreItems,
    currentPage,
    loadMore,
    setPage,
    fetchMessages,
    deleteMessage,
  };
}
