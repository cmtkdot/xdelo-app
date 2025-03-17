
'use client'

import React, { useState, useMemo } from 'react';
import { Message } from '@/types/entities/Message';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/useMobile';
import { useMessageViewHandlers } from '@/hooks/useMessageViewHandlers';
import { useEnhancedMessages } from '@/hooks/useEnhancedMessages';
import { MediaViewer } from '@/components/ui/media-viewer';
import { MessageFilterBar } from '@/components/EnhancedMessages/MessageFilterBar';
import { MessageFilterPanel } from '@/components/EnhancedMessages/MessageFilterPanel';
import { MessageViewContainer } from '@/components/EnhancedMessages/MessageViewContainer';

const ITEMS_PER_PAGE = 50;

export default function MessagesEnhanced() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [showMode, setShowMode] = useState<'list' | 'grid'>('grid');
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<Date[] | undefined>(undefined);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState<number[]>([100])
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Now using the updated hook with correct types
  const { 
    selectedMessages, 
    handleToggleSelect, 
    clearSelection,
    getSelectedMessageIds,
    deleteMessage,
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    isProcessing,
    processingMessageIds
  } = useMessageViewHandlers();
  
  const { 
    messages: items, 
    groupedMessages,
    isLoading, 
    refetch
  } = useEnhancedMessages({
    limit: ITEMS_PER_PAGE,
    searchTerm: debouncedSearch,
  });
  
  const [viewItem, setViewItem] = useState<Message[] | null>(null);
  const [editItem, setEditItem] = useState<Message | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  
  const totalItems = items?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  
  const paginatedItems = useMemo(() => {
    if (!items) return [];
    return showMode === 'grid' ? groupedMessages : items;
  }, [items, groupedMessages, showMode]);
  
  // Update to accept Message[] as parameter
  const handleViewMessage = (messages: Message[]) => {
    setViewItem(messages);
    setViewerOpen(true);
  };
  
  const handleEditMessage = (message: Message) => {
    setEditItem(message);
  };
  
  const handleDeleteMessage = async (id: string) => {
    try {
      await deleteMessage({id} as Message, false);
      toast({
        title: 'Message deleted',
        description: 'The message has been successfully deleted.',
      });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error deleting message',
        description: 'There was an error deleting the message. Please try again.',
      });
    }
  };

  // Function to handle loading more items
  const handleLoadMore = async () => {
    // We'll just refresh the data for now
    await refetch();
  };

  // Check if we can load more based on the available data
  const hasMoreItems = useMemo(() => {
    return totalItems > paginatedItems.length;
  }, [totalItems, paginatedItems]);

  const toggleFilterPanel = () => setIsFilterOpen(!isFilterOpen);
  const toggleShowMode = () => setShowMode(showMode === 'grid' ? 'list' : 'grid');
  
  return (
    <div className="container mx-auto py-10">
      <MessageFilterBar 
        search={search}
        onSearchChange={setSearch}
        isFilterOpen={isFilterOpen}
        toggleFilter={toggleFilterPanel}
        showMode={showMode}
        onToggleShowMode={toggleShowMode}
        clearSelection={clearSelection}
        getSelectedMessageIds={getSelectedMessageIds}
      />
      
      <MessageFilterPanel isVisible={isFilterOpen} />
      
      <MessageViewContainer 
        showMode={showMode}
        paginatedItems={paginatedItems}
        isLoading={isLoading}
        hasMoreItems={hasMoreItems}
        handleLoadMore={handleLoadMore}
        handleViewMessage={handleViewMessage}
        handleEditMessage={handleEditMessage}
        handleDeleteMessage={handleDeleteMessage}
        handleToggleSelect={handleToggleSelect}
        selectedMessages={selectedMessages}
      />
      
      {viewItem && (
        <MediaViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          currentGroup={viewItem}
        />
      )}
    </div>
  );
}
