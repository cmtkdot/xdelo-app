
import { Message } from "@/types";
import { useState, useEffect, useMemo, Suspense } from 'react';
import { toast } from "sonner";
import { Grid, List, SlidersHorizontal } from "lucide-react";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { EmptyState } from "@/components/PublicGallery/EmptyState";
import { LoadMoreButton } from "@/components/PublicGallery/LoadMoreButton";
import { GalleryTableView } from "@/components/PublicGallery/GalleryTableView";
import { PublicMediaViewer, PublicMediaCard, usePublicViewer } from "@/components/public-viewer";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { usePublicGallery } from "@/hooks/usePublicGallery";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsMobile } from "@/hooks/useMobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const PublicGallery = () => {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(isMobile ? 'grid' : 'grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
  
  // Use the public viewer hook with enhanced performance
  const {
    isOpen,
    currentGroup,
    hasNext,
    hasPrevious,
    openViewer,
    closeViewer,
    goToNextGroup,
    goToPreviousGroup,
  } = usePublicViewer(mediaGroups);

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
      
      // Open viewer with this group and position it at the clicked message
      openViewer(group, messageIndex);
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
  
  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 md:py-8 max-w-7xl">
      {/* Mobile Filter Bar */}
      {isMobile ? (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm mb-4 pb-3 pt-1 border-b">
          <div className="flex items-center justify-between gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gallery..."
                className="w-full h-9 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background"
              />
              {search && (
                <button 
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" 
                  onClick={() => setSearch('')}
                >
                  ×
                </button>
              )}
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-9 px-2 rounded-none border-0"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="h-9 px-2 rounded-none border-0"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Filter Sheet Trigger */}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 px-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only md:inline">Filters</span>
                  {activeFilters.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                      {activeFilters.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:max-w-md p-0">
                <div className="p-6 h-full overflow-y-auto">
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
                    onClose={() => setIsFilterOpen(false)}
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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-5">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="relative aspect-square rounded-md overflow-hidden">
              <Skeleton className="h-full w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-5">
                <Suspense fallback={
                  <div className="col-span-full flex justify-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 rounded-full border-2 border-primary border-l-transparent animate-spin"></div>
                      <div className="text-sm text-muted-foreground">Loading media...</div>
                    </div>
                  </div>
                }>
                  {filteredMessages.map(message => (
                    <PublicMediaCard 
                      key={message.id} 
                      message={message} 
                      onClick={() => handleMediaClick(message)}
                      className="transform transition-transform hover:scale-[1.02] focus:scale-[1.02] will-change-transform"
                    />
                  ))}
                </Suspense>
              </div>

              {filteredMessages.length === 0 && <EmptyState />}

              <LoadMoreButton 
                onClick={loadMore} 
                isLoading={isLoadingMore}
                hasMoreItems={hasMoreItems} 
              />
            </>
          ) : (
            <GalleryTableView 
              messages={filteredMessages} 
              onMediaClick={handleMediaClick}
              onDeleteMessage={handleDeleteMessage}
            />
          )}

          {/* Public Media Viewer - Optimized with Suspense and lazy loading */}
          <Suspense fallback={null}>
            <PublicMediaViewer
              isOpen={isOpen}
              onClose={closeViewer}
              currentGroup={currentGroup}
              onPrevious={goToPreviousGroup}
              onNext={goToNextGroup}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              onDelete={handleDeleteMessage}
            />
          </Suspense>
        </>
      )}
    </div>
  );
};

export default PublicGallery;
