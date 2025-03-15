
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Message } from '@/types/entities/Message';
import { MessageList } from '@/components/MessageList';
import { MessageGrid } from '@/components/MessageGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Slider,
} from "@/components/ui/slider"
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  ArrowDown, 
  ArrowUp, 
  Copy, 
  Download, 
  ExternalLink, 
  Filter, 
  Grip, 
  GripVertical, 
  Loader2, 
  MoreHorizontal, 
  Plus, 
  Search, 
  Share2, 
  Trash2 
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/useMobile';
import { useMessageViewHandlers } from '@/hooks/useMessageViewHandlers';
import { useEnhancedMessages } from '@/hooks/useEnhancedMessages';
import { MediaViewer } from '@/components/ui/media-viewer';

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
    // Note: chatIds is not in the interface, so we'll remove it
    dateRange: selectedDateRange
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
  
  const handleViewMessage = (message: Message[]) => {
    setViewItem(message);
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

  // Function to handle loading more items - this is a stub since we don't have infinite loading in useEnhancedMessages
  const handleLoadMore = async () => {
    // We'll just refresh the data for now
    await refetch();
  };

  // Check if we can load more based on the available data
  const hasMoreItems = useMemo(() => {
    return totalItems > paginatedItems.length;
  }, [totalItems, paginatedItems]);

  const renderMessages = () => {
    if (showMode === 'grid') {
      return (
        <MessageGrid 
          mediaGroups={paginatedItems as Message[][]} 
          isLoading={isLoading} 
          onView={handleViewMessage}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
          onToggleSelect={(message, selected) => handleToggleSelect(message, selected)}
          selectedMessages={selectedMessages}
        />
      );
    }
    
    return (
      <MessageList 
        messages={paginatedItems as Message[]}
        isLoading={isLoading}
        onView={handleViewMessage}
        onDelete={handleDeleteMessage}
        onEdit={handleEditMessage}
        onToggleSelect={(message, selected) => handleToggleSelect(message, selected)}
        selectedMessages={selectedMessages}
      />
    );
  };
  
  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" size="icon" onClick={() => setIsFilterOpen(!isFilterOpen)}>
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setShowMode(showMode === 'grid' ? 'list' : 'grid')}>
            Show {showMode === 'grid' ? 'List' : 'Grid'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions <MoreHorizontal className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => clearSelection()}>
                Clear Selection <Copy className="ml-auto h-4 w-4" />
              </DropdownMenuItem>
              <DropdownMenuItem disabled={getSelectedMessageIds().length === 0}>
                Delete Selected <Trash2 className="ml-auto h-4 w-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {isFilterOpen && (
        <div className="mb-4 p-4 border rounded-md">
          <h3 className="text-lg font-semibold mb-2">Filters</h3>
          {/* Add filter components here */}
          <p>Filter options will be added here.</p>
        </div>
      )}
      
      {renderMessages()}
      
      {hasMoreItems && (
        <Button variant="outline" className="w-full mt-4" onClick={handleLoadMore}>
          {isLoading ? (
            <>
              Loading more...
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </>
          ) : (
            'Load More'
          )}
        </Button>
      )}
      
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
