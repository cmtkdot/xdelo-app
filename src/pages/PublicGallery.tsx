
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GalleryCard } from "@/components/PublicGallery/GalleryCard";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { EmptyState } from "@/components/PublicGallery/EmptyState";
import { LoadMoreButton } from "@/components/PublicGallery/LoadMoreButton";
import { SearchToolbar } from "@/components/PublicGallery/SearchToolbar";
import { usePublicGallerySearch } from "@/hooks/publicGallery/usePublicGallerySearch";
import { PublicGalleryDetail } from "@/components/PublicGallery/PublicGalleryDetail";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
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

  // Handler for opening the detail view
  const handleOpenDetail = (message: Message) => {
    setSelectedMessage(message);
    setSelectedIndex(finalFilteredMessages.findIndex(m => m.id === message.id));
    setIsDetailOpen(true);
  };

  // Get related messages for the current selection (for media groups)
  const getRelatedMessages = (): Message[] => {
    if (!selectedMessage?.media_group_id) return [];
    
    return messages.filter(
      m => m.media_group_id === selectedMessage.media_group_id && m.id !== selectedMessage.id
    );
  };

  // Navigation handlers for the detail view
  const handlePreviousItem = () => {
    if (selectedIndex > 0) {
      const prevIndex = selectedIndex - 1;
      setSelectedIndex(prevIndex);
      setSelectedMessage(finalFilteredMessages[prevIndex]);
    }
  };

  const handleNextItem = () => {
    if (selectedIndex < finalFilteredMessages.length - 1) {
      const nextIndex = selectedIndex + 1;
      setSelectedIndex(nextIndex);
      setSelectedMessage(finalFilteredMessages[nextIndex]);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold mb-4 text-center md:text-left">Public Gallery</h1>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <GalleryFilters filter={filter} setFilter={setFilter} />
          <SearchToolbar
            searchTerm={searchTerm}
            onSearch={handleSearch}
            onClear={clearSearch}
            placeholder="Search products, vendors, codes..."
            isSearching={isSearching}
          />
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {finalFilteredMessages.map(message => (
              <GalleryCard 
                key={message.id} 
                message={message} 
                onClick={handleOpenDetail} 
              />
            ))}
          </div>

          {finalFilteredMessages.length === 0 && (
            <EmptyState message={searchTerm ? "No results found for your search" : undefined} />
          )}

          {/* Only show load more button when not searching */}
          {!searchTerm && (
            <LoadMoreButton 
              onClick={loadMore} 
              isLoading={isLoadingMore}
              hasMoreItems={hasMoreItems} 
            />
          )}

          {/* Detail view */}
          {selectedMessage && (
            <PublicGalleryDetail
              isOpen={isDetailOpen}
              onClose={() => setIsDetailOpen(false)}
              message={selectedMessage}
              relatedMessages={getRelatedMessages()}
              onPrevious={handlePreviousItem}
              onNext={handleNextItem}
              hasPrevious={selectedIndex > 0}
              hasNext={selectedIndex < finalFilteredMessages.length - 1}
            />
          )}
        </>
      )}
    </div>
  );
};

export default PublicGallery;
