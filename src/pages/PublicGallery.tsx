import { Message } from "@/types";
import { adaptMessage } from '@/lib/messageAdapter';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { EmptyState } from "@/components/PublicGallery/EmptyState";
import { LoadMoreButton } from "@/components/PublicGallery/LoadMoreButton";
import { GalleryTableView } from "@/components/PublicGallery/GalleryTableView";
import { PublicMediaViewer, PublicMediaCard, usePublicViewer } from "@/components/public-viewer";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { usePublicGallery } from "@/hooks/usePublicGallery";

const PublicGallery = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const { handleDelete, isProcessing } = useTelegramOperations();
  
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

  const handleMediaClick = (message: Message) => {
    const groupIndex = mediaGroups.findIndex(group => 
      group.some(item => item.id === message.id)
    );
    
    if (groupIndex !== -1) {
      const group = mediaGroups[groupIndex];
      const messageIndex = group.findIndex(item => item.id === message.id);
      
      openViewer(group, messageIndex);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      const messageToDelete = messages.find(message => message.id === id);
      if (!messageToDelete) {
        toast.error("Message not found");
        return;
      }
      
      deleteMessage(id);
      
      const adaptedMessage = adaptMessage(messageToDelete);
      
      await handleDelete(adaptedMessage, false);
      
      toast.success("Item deleted successfully");
    } catch (error) {
      console.error("Error in delete operation:", error);
      toast.error("An error occurred during deletion");
      
      fetchMessages(currentPage);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
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
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {filteredMessages.map(message => (
                  <PublicMediaCard 
                    key={message.id} 
                    message={message} 
                    onClick={() => handleMediaClick(message)} 
                  />
                ))}
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
        </>
      )}
    </div>
  );
};

export default PublicGallery;
