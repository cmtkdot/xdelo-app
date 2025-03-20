import { Message } from "@/types";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GalleryCard } from "@/components/PublicGallery/GalleryCard";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { EmptyState } from "@/components/PublicGallery/EmptyState";
import { LoadMoreButton } from "@/components/PublicGallery/LoadMoreButton";
import { GalleryTableView } from "@/components/PublicGallery/GalleryTableView";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const itemsPerPage = 16;
  
  // Use our custom hook to handle search
  const { 
    searchTerm, 
    filteredMessages, 
    isSearching, 
    handleSearch, 
    clearSearch 
  } = usePublicGallerySearch({ messages });

  const fetchMessages = async (page = 1, append = false) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .is('deleted_from_telegram', false)
        .order('created_at', { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      if (error) {
        console.error("Error fetching messages:", error);
        toast.error("Error loading gallery");
        return;
      }

      if (data) {
        // Use type assertion to convert database response to Message[]
        const newMessages = data as unknown as Message[];
        
        if (newMessages.length < itemsPerPage) {
          setHasMoreItems(false);
        } else {
          setHasMoreItems(true);
        }

        if (append) {
          setMessages(prev => [...prev, ...newMessages]);
        } else {
          setMessages(newMessages);
        }
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchMessages(nextPage, true);
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  // Apply content-type filter to the already search-filtered messages
  const applyMediaTypeFilter = (messages: Message[]) => {
    if (filter === "all") {
      return messages;
    } else if (filter === "images") {
      return messages.filter(m => m.mime_type?.startsWith('image/'));
    } else if (filter === "videos") {
      return messages.filter(m => m.mime_type?.startsWith('video/'));
    }
    return messages;
  };

  // Get the final filtered messages by applying both search and media type filters
  const finalFilteredMessages = applyMediaTypeFilter(filteredMessages);

  const handleMediaClick = (message: Message) => {
    if (message.media_group_id) {
      const groupMedia = messages.filter(m => m.media_group_id === message.media_group_id);
      setSelectedMedia(groupMedia);
    } else {
      setSelectedMedia([message]);
    }
    setIsViewerOpen(true);
  };

  // CRUD operations for messages
  const handleDeleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_from_telegram: true })
        .eq('id', id);

      if (error) {
        toast.error("Failed to delete item");
        console.error("Error deleting message:", error);
        return;
      }

      // Update local state by removing the deleted message
      setMessages(prev => prev.filter(message => message.id !== id));
      toast.success("Item deleted successfully");
    } catch (error) {
      console.error("Error in delete operation:", error);
      toast.error("An error occurred");
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
                  <GalleryCard 
                    key={message.id} 
                    message={message} 
                    onClick={handleMediaClick} 
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

          <MediaViewer 
            isOpen={isViewerOpen} 
            onClose={() => setIsViewerOpen(false)} 
            currentGroup={selectedMedia} 
          />
        </>
      )}
    </div>
  );
};

export default PublicGallery;
