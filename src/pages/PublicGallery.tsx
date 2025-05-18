
import { GalleryFilters } from "@/components/public-gallery/GalleryFilters";
import { PublicMediaCard, PublicMediaViewer } from "@/components/public-viewer";
import { EmptyState } from "@/components/public-viewer/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/useDebounce";
import { usePublicGallery } from "@/hooks/usePublicGallery";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { Message } from "@/types";
import { Grid, List, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * PublicGallery component that displays a grid of messages with images
 * and videos from the messages table in Supabase.
 */
const PublicGallery = () => {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const { handleDelete } = useTelegramOperations();

  // Local state for search
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);

  // Initialize search term from URL params if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get("search");
    if (urlSearch) {
      setSearch(urlSearch);
    }
  }, []);

  // Update URL when search changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }

    const newUrl = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    window.history.replaceState({}, "", newUrl);
  }, [debouncedSearch]);

  const {
    messages,
    filteredMessages,
    mediaGroups,
    isLoading,
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
    loadMore,
    deleteMessage,
  } = usePublicGallery({
    itemsPerPage: 24, // Increased for better grid appearance
  });

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
    const groupIndex = mediaGroups.findIndex((group) =>
      group.some((item) => item.id === message.id)
    );

    if (groupIndex !== -1) {
      const group = mediaGroups[groupIndex];
      // Find index of this message within its group
      const messageIndex = group.findIndex((item) => item.id === message.id);

      // Open viewer with this group
      openViewer(groupIndex, messageIndex >= 0 ? messageIndex : 0);
    }
  };

  // Handle deleting a message
  const handleDeleteMessage = async (id: string) => {
    try {
      // Find the message to delete
      const messageToDelete = messages.find((message) => message.id === id);
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
    }
  };

  // Memoize current active filters for better performance
  const activeFilters = useMemo(() => {
    const filters = [];
    if (filter !== "all") filters.push(filter);
    if (vendorFilter.length > 0) filters.push(`${vendorFilter.length} vendors`);
    if (dateField !== "created_at") filters.push("Custom date");
    if (sortOrder !== "desc") filters.push("Ascending");
    if (searchTerm) filters.push(`"${searchTerm}"`);
    return filters;
  }, [filter, vendorFilter, dateField, sortOrder, searchTerm]);

  // Check for network connectivity
  useEffect(() => {
    const checkNetworkStatus = () => {
      const isOnline = navigator.onLine;
      setIsNetworkError(!isOnline);
    };

    checkNetworkStatus();
    window.addEventListener("online", checkNetworkStatus);
    window.addEventListener("offline", checkNetworkStatus);

    return () => {
      window.removeEventListener("online", checkNetworkStatus);
      window.removeEventListener("offline", checkNetworkStatus);
    };
  }, []);

  return (
    <div className="container px-2 py-4 mx-auto sm:px-4 md:py-8 max-w-7xl">
      {/* Mobile Filter Bar - ONLY VISIBLE ON SMALL SCREENS */}
      <div className="sticky top-0 z-10 pt-1 pb-3 mb-4 border-b bg-background/95 backdrop-blur-sm md:hidden">
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
                onClick={() => setSearch("")}
              >
                ×
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex overflow-hidden border rounded-md">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className="px-2 border-0 rounded-none h-9"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="px-2 border-0 rounded-none h-9"
              onClick={() => setViewMode("table")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Filter Sheet Trigger */}
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 px-2 h-9">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="sr-only">Filters</span>
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1 ml-1 text-xs">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <GalleryFilters
                filter={filter}
                setFilter={setFilter}
                viewMode={viewMode}
                setViewMode={setViewMode}
                searchTerm={search}
                onSearchChange={setSearch}
                vendorFilter={vendorFilter}
                vendors={vendors}
                onVendorFilterChange={setVendorFilter}
                dateField={dateField}
                onDateFieldChange={setDateField}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                hideSearch={true}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {/* Filters (Desktop) - ONLY VISIBLE ON MEDIUM AND LARGER SCREENS */}
        <div className="hidden md:block col-span-3">
          <GalleryFilters
            filter={filter}
            setFilter={setFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchTerm={search}
            onSearchChange={setSearch}
            vendorFilter={vendorFilter}
            vendors={vendors}
            onVendorFilterChange={setVendorFilter}
            dateField={dateField}
            onDateFieldChange={setDateField}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />
        </div>

        {/* Gallery Content */}
        <div className="col-span-1 md:col-span-9">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded shadow">
                  <Skeleton className="w-full aspect-square" />
                  <div className="p-2">
                    <Skeleton className="w-3/4 h-4 mb-2" />
                    <Skeleton className="w-1/2 h-3" />
                  </div>
                </div>
              ))}
            </div>
          ) : isNetworkError ? (
            <EmptyState
              message="Network connection lost"
              subMessage="Please check your internet connection and try again."
            />
          ) : filteredMessages.length === 0 ? (
            <EmptyState
              message={
                searchTerm
                  ? `No results found for "${searchTerm}"`
                  : "No media items found"
              }
              subMessage={
                searchTerm
                  ? "Try adjusting your search term or filters"
                  : "There are no media items in the gallery."
              }
            />
          ) : (
            <div className="space-y-4">
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {mediaGroups.map((group, groupIndex) => {
                    const message = group[0]; // Use first message as representative
                    return (
                      <PublicMediaCard
                        key={message.id}
                        message={message}
                        onClick={() => handleMediaClick(message)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="w-16 px-4 py-2 text-left">Media</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Code</th>
                        <th className="px-4 py-2 text-left">Created</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mediaGroups.map((group) => {
                        const message = group[0]; // Use first message as representative
                        return (
                          <tr
                            key={message.id}
                            className="border-b cursor-pointer hover:bg-muted/50"
                            onClick={() => handleMediaClick(message)}
                          >
                            <td className="px-4 py-2">
                              <div className="relative w-12 h-12 overflow-hidden rounded">
                                <img
                                  src={
                                    message.thumbnail_path ||
                                    message.file_paths?.[0] ||
                                    "/placeholder-image.jpg"
                                  }
                                  alt="Thumbnail"
                                  className="object-cover w-full h-full"
                                />
                                {group.length > 1 && (
                                  <div className="absolute top-0 right-0 px-1 text-xs text-white bg-black/70 rounded-bl">
                                    +{group.length - 1}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              {message.product_name ||
                                message.caption ||
                                "Untitled"}
                            </td>
                            <td className="px-4 py-2">
                              {message.product_code || "-"}
                            </td>
                            <td className="px-4 py-2">
                              {message.created_at
                                ? new Date(
                                    message.created_at
                                  ).toLocaleDateString()
                                : "-"}
                            </td>
                            <td className="px-4 py-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMessage(message.id);
                                }}
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {hasMoreItems && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Media Viewer */}
      {isViewerOpen && currentGroup && (
        <PublicMediaViewer
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          messages={currentGroup}
          initialIndex={currentImageIndex}
          onPrevious={hasPreviousGroup ? goToPreviousGroup : undefined}
          onNext={hasNextGroup ? goToNextGroup : undefined}
          onDelete={handleDeleteMessage}
        />
      )}
    </div>
  );
};

export default PublicGallery;
