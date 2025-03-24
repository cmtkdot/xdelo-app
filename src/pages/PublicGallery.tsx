
import { Message } from "@/types";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { EmptyState } from "@/components/PublicGallery/EmptyState";
import { LoadMoreButton } from "@/components/PublicGallery/LoadMoreButton";
import { GalleryTableView } from "@/components/PublicGallery/GalleryTableView";
import { PublicMediaViewer, PublicMediaCard, usePublicViewer } from "@/components/public-viewer";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);
  const [dateField, setDateField] = useState<'purchase_date' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [vendors, setVendors] = useState<string[]>([]);
  const itemsPerPage = 16;

  // Prepare media groups for the viewer
  const mediaGroups = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    
    // Group messages by media_group_id or individually
    filteredMessages.forEach(message => {
      if (message.media_group_id) {
        groups[message.media_group_id] = groups[message.media_group_id] || [];
        groups[message.media_group_id].push(message);
      } else {
        // For messages without a group, use the message ID as a key
        groups[message.id] = [message];
      }
    });
    
    // Convert record to array of arrays
    return Object.values(groups);
  }, [filteredMessages]);

  // Use the public viewer hook
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

  // Fetch available vendors for filter
  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('vendor_uid')
        .is('deleted_from_telegram', false)
        .not('vendor_uid', 'is', null)
        .order('vendor_uid');

      if (error) {
        console.error("Error fetching vendors:", error);
        return;
      }

      if (data) {
        // Extract unique vendor values
        const uniqueVendors = [...new Set(data.map(item => item.vendor_uid).filter(Boolean))];
        setVendors(uniqueVendors);
      }
    } catch (err) {
      console.error("Error in fetchVendors:", err);
    }
  };

  const fetchMessages = async (page = 1, append = false) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Build the base query
      let query = supabase
        .from('messages')
        .select('*')
        .is('deleted_from_telegram', false);

      // Apply vendor filter if any
      if (vendorFilter.length > 0) {
        query = query.in('vendor_uid', vendorFilter);
      }

      // Apply sort order
      query = query.order(dateField, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      const { data, error } = await query;

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
    fetchVendors();
  }, [vendorFilter, dateField, sortOrder]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, vendorFilter, dateField, sortOrder]);

  // Apply filters whenever messages or filter change
  useEffect(() => {
    let result = [...messages];
    
    // Apply search filter if search term exists
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(msg => 
        (msg.caption && msg.caption.toLowerCase().includes(term))
      );
    }
    
    // Apply media type filter
    if (filter === "images") {
      result = result.filter(m => m.mime_type?.startsWith('image/'));
    } else if (filter === "videos") {
      result = result.filter(m => m.mime_type?.startsWith('video/'));
    }
    
    setFilteredMessages(result);
  }, [messages, filter, searchTerm]);

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

          {/* Public Media Viewer */}
          <PublicMediaViewer
            isOpen={isOpen}
            onClose={closeViewer}
            currentGroup={currentGroup}
            onPrevious={goToPreviousGroup}
            onNext={goToNextGroup}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        </>
      )}
    </div>
  );
};

export default PublicGallery;
