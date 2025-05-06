import { EmptyState } from "@/components/PublicGallery/EmptyState";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { GalleryTableView } from "@/components/PublicGallery/GalleryTableView";
import { LoadMoreButton } from "@/components/PublicGallery/LoadMoreButton";
import { PublicMediaCard, PublicMediaViewer } from "@/components/public-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsMobile } from "@/hooks/useMobile";
import { usePublicGallery } from "@/hooks/usePublicGallery";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { Message } from "@/types";
import { getMainMediaFromGroup } from "@/utils/mediaUtils";
import { Grid, List, SlidersHorizontal } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from 'react';
import { toast } from "sonner";

const PublicGallery = () => {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(isMobile ? 'grid' : 'grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const { handleDelete } = useTelegramOperations();

  // Local state for filter controls
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);

  // Initialize search term from URL params if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get('search');
    if (urlSearch) {
      setSearch(urlSearch);
    }
  }, []);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    } else {
      params.delete('search');
    }

    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [debouncedSearch]);

  const {
    messages,
    filteredMessages,
    mediaGroups,
    isLoading,
    isLoadingMore,
    hasMoreItems,
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
    vendors,
    currentPage,
    fetchMessages,
    loadMore,
    deleteMessage
  } = usePublicGallery();

  // Sync local search with gallery hook
  useEffect(() => {
    setSearchTerm(debouncedSearch);
  }, [debouncedSearch, setSearchTerm]);

  // State for media viewer
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Computed properties for media viewer navigation
  const hasNextGroup = currentGroupIndex < mediaGroups.length - 1;
  const hasPreviousGroup = currentGroupIndex > 0;
  const currentGroup = mediaGroups[currentGroupIndex] || [];

  // Function to open the viewer with a specific group and image
  const openViewer = (groupIndex: number, imageIndex: number = 0) => {
    setCurrentGroupIndex(groupIndex);
    setCurrentImageIndex(imageIndex);
    setIsViewerOpen(true);
  };

  // Navigation functions for the media viewer
  const goToNextGroup = () => {
    if (hasNextGroup) {
      setCurrentGroupIndex(currentGroupIndex + 1);
      setCurrentImageIndex(0);
    }
  };

  const goToPreviousGroup = () => {
    if (hasPreviousGroup) {
      setCurrentGroupIndex(currentGroupIndex - 1);
      setCurrentImageIndex(0);
    }
  };

  // Function to find and open the correct group based on clicked item
  const handleMediaClick = (message: Message) => {
    // Find which group this message belongs to
    const groupIndex = mediaGroups.findIndex(group =>
      group.some(item => item.id === message.id)
    );

    if (groupIndex !== -1) {
      const group = mediaGroups[groupIndex];
      // Find index of this message within its group
      const messageIndex = group.findIndex(item => item.id === message.id);

      // Open viewer with this group
      openViewer(groupIndex, messageIndex >= 0 ? messageIndex : 0);
    }
  };

  // CRUD operations for messages
  const handleDeleteMessage = async (id: string) => {
    try {
      // Find the message to delete
      const messageToDelete = messages.find(message => message.id === id);
      if (!messageToDelete) {
        toast.error("Message not found");
        return;
      }

      // For UI responsiveness, update the local state immediately
      deleteMessage(id);

      // Now let the Telegram operations handle the actual deletion
      await handleDelete(messageToDelete, false);

      toast.success("Item deleted successfully");
    } catch (error) {
      console.error("Error in delete operation:", error);
      toast.error("An error occurred during deletion");

      // Revert the optimistic update if the deletion failed
      fetchMessages(currentPage);
    }
  };

  // Memoize current active filters for better performance
  const activeFilters = useMemo(() => {
    const filters = [];
    if (filter !== 'all') filters.push(filter);
    if (vendorFilter.length > 0) filters.push(`${vendorFilter.length} vendors`);
    if (dateField !== 'created_at') filters.push('Custom date');
    if (sortOrder !== 'desc') filters.push('Ascending');
    if (searchTerm) filters.push(`"${searchTerm}"`);
    return filters;
  }, [filter, vendorFilter, dateField, sortOrder, searchTerm]);

  useEffect(() => {
    console.log("PublicGallery - Messages count:", messages.length);
    console.log("PublicGallery - Filtered messages count:", filteredMessages.length);
    console.log("PublicGallery - Media groups count:", mediaGroups.length);
    
    // Check for network connectivity
    const checkNetworkStatus = () => {
      const isOnline = navigator.onLine;
      console.log("Network status - Online:", isOnline);
      setIsNetworkError(!isOnline);
    };
    
    checkNetworkStatus();
    window.addEventListener('online', checkNetworkStatus);
    window.addEventListener('offline', checkNetworkStatus);
    
    return () => {
      window.removeEventListener('online', checkNetworkStatus);
      window.removeEventListener('offline', checkNetworkStatus);
    };
  }, [messages.length, filteredMessages.length, mediaGroups.length]);

  const handleRefresh = () => {
    fetchMessages(currentPage);
  };

  return (
    <div className="container px-2 py-4 mx-auto sm:px-4 md:py-8 max-w-7xl">
      {/* Mobile Filter Bar */}
      {isMobile ? (
        <div className="sticky top-0 z-10 pt-1 pb-3 mb-4 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gallery..."
                className="w-full px-3 py-2 text-sm border rounded-md h-9 border-input bg-background ring-offset-background"
              />
              {search && (
                <button
                  className="absolute -translate-y-1/2 right-2 top-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch('')}
                >
                  ×
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex overflow-hidden border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="px-2 border-0 rounded-none h-9"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="px-2 border-0 rounded-none h-9"
                onClick={() => setViewMode('table')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Filter Sheet Trigger */}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 px-2 h-9">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="sr-only md:not-sr-only md:inline">Filters</span>
                  {activeFilters.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1 ml-1 text-xs">
                      {activeFilters.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:max-w-md p-0">
                <div className="h-full p-6 overflow-y-auto">
                  <GalleryFilters
                    filter={filter}
                    setFilter={setFilter}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    vendorFilter={vendorFilter}
                    vendors={vendors}
                    onVendorFilterChange={setVendorFilter}
                    dateField={dateField}
                    onDateFieldChange={setDateField}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    searchTerm={search}
                    onSearchChange={setSearch}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto py-2 scrollbar-none">
              {activeFilters.map((filter, index) => (
                <Badge key={index} variant="outline" className="whitespace-nowrap">
                  {filter}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-6 animate-fade-in">
          <GalleryFilters
            filter={filter}
            setFilter={setFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            vendorFilter={vendorFilter}
            vendors={vendors}
            onVendorFilterChange={setVendorFilter}
            dateField={dateField}
            onDateFieldChange={setDateField}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            searchTerm={search}
            onSearchChange={setSearch}
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-3 md:gap-4 lg:gap-5">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="relative overflow-hidden rounded-md aspect-square">
              <Skeleton className="w-full h-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-3 md:gap-4 lg:gap-5">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="relative overflow-hidden rounded-md aspect-square">
                      <div className="w-full h-full bg-muted animate-pulse"></div>
                    </div>
                  ))
                ) : (
                  <Suspense fallback={
                    <div className="flex justify-center py-8 col-span-full">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 rounded-full border-primary border-l-transparent animate-spin"></div>
                        <div className="text-sm text-muted-foreground">Loading media...</div>
                      </div>
                    </div>
                  }>
                    {mediaGroups.length > 0 ? (
                      mediaGroups.map((group, groupIndex) => {
                        // In "all" filter mode, only show the representative thumbnail
                        // In specific filter modes, show all items that match the filter
                        const thumbnailMedia = filter === 'all'
                          ? group.find(m => m.isGroupThumbnail) || getMainMediaFromGroup(group) || group[0]
                          : group[0];

                        if (!thumbnailMedia) {
                          console.log("No thumbnail found for group at index:", groupIndex);
                          return null;
                        }

                        return (
                          <div key={thumbnailMedia.id || `group-${groupIndex}`} className="group-card relative">
                            <PublicMediaCard
                              key={thumbnailMedia.id || `media-${groupIndex}`}
                              message={thumbnailMedia}
                              onClick={() => handleMediaClick(thumbnailMedia)}
                            />
                            {/* Removed count indicator div as requested */}
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-4">
                        <EmptyState isNetworkError={isNetworkError} onTryAgain={handleRefresh} />
                      </div>
                    )}
                  </Suspense>
                )}
              </div>

              {!isLoading && mediaGroups.length === 0 ? null : (
                <LoadMoreButton
                  onClick={loadMore}
                  isLoading={isLoadingMore}
                  hasMoreItems={hasMoreItems}
                />
              )}
            </>
          ) : (
            <GalleryTableView
              messages={filteredMessages}
              onMediaClick={handleMediaClick}
              onDeleteMessage={handleDeleteMessage}
            />
          )}

          {/* Public Media Viewer */}
          <PublicMediaViewer
            isOpen={isViewerOpen}
            onClose={() => setIsViewerOpen(false)}
            currentGroup={currentGroup}
            onPrevious={goToPreviousGroup}
            onNext={goToNextGroup}
            hasPrevious={hasPreviousGroup}
            hasNext={hasNextGroup}
            onDelete={handleDeleteMessage}
          />
        </>
      )}
    </div>
  );
};

export default PublicGallery;
