
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Message, ProcessingState, LogEventType } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useMediaGroups } from '@/hooks/useMediaGroups';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';
import { logEvent } from '@/lib/logUtils';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { 
  Grid,
  LayoutGrid, 
  LayoutList, 
  Filter, 
  SlidersHorizontal, 
  PanelRight, 
  BarChart3, 
  X,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { EnhancedMessagesHeader } from '@/components/EnhancedMessages/EnhancedMessagesHeader';
import { MessageGridView } from '@/components/EnhancedMessages/MessageGridView';
import { MessageListView } from '@/components/EnhancedMessages/MessageListView';
import { EnhancedFiltersPanel } from '@/components/EnhancedMessages/EnhancedFiltersPanel';
import { MessageDetailsPanel } from '@/components/EnhancedMessages/MessageDetailsPanel';
import { MessageAnalyticsPanel } from '@/components/EnhancedMessages/MessageAnalyticsPanel';
import { messageToMediaItem } from '@/lib/mediaUtils';
import { cn } from '@/lib/utils';
import { useMessagesStore } from '@/hooks/useMessagesStore';

export interface EnhancedMessageFilterState {
  search: string;
  processingStates: ProcessingState[];
  mediaTypes: string[];
  dateRange: { from: Date; to: Date } | null;
  vendors: string[];
  showGroups: boolean;
  chatSources: string[];
  page: number;
  itemsPerPage: number;
  view: 'grid' | 'list';
  sortField: 'created_at' | 'updated_at' | 'purchase_date';
  sortOrder: 'asc' | 'desc';
}

const MessagesEnhanced = () => {
  console.log('MessagesEnhanced component rendering');
  
  // Initialize the global state
  const { 
    filters, setFilters,
    selectedMessage, setSelectedMessage,
    detailsOpen, setDetailsOpen,
    analyticsOpen, setAnalyticsOpen,
    refreshData 
  } = useMessagesStore();

  // Local UI state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Message[]>([]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [editDialogMessage, setEditDialogMessage] = useState<Message | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [errorState, setErrorState] = useState<Error | null>(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Fetch data using existing hooks
  const { data: mediaGroups, isLoading, error, refetch } = useMediaGroups();
  const { messages: realtimeMessages, handleRefresh } = useRealTimeMessages({
    limit: 100,
    processingState: filters.processingStates,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Log any errors for debugging
  useEffect(() => {
    if (error) {
      console.error('Error in MessagesEnhanced:', error);
      setErrorState(error as Error);
    }
  }, [error]);

  // Debug the mediaGroups data
  useEffect(() => {
    console.log('mediaGroups updated:', mediaGroups ? Object.keys(mediaGroups).length : 'null');
  }, [mediaGroups]);

  // Memoize the filtered messages to avoid recalculation
  const filteredMessages = useMemo(() => {
    try {
      console.log('Calculating filteredMessages, mediaGroups:', mediaGroups ? Object.keys(mediaGroups).length : 'null');
      
      // Return an array of message groups based on the current filters
      const groups = Object.values(mediaGroups || {});
      
      // Apply all filters
      return groups.filter(group => {
        try {
          // Filter logic for various criteria
          const mainMessage = group[0];
          if (!mainMessage) return false;

          // Search filter
          if (filters.search && mainMessage.caption) {
            const searchLower = filters.search.toLowerCase();
            const captionMatch = mainMessage.caption.toLowerCase().includes(searchLower);
            const productMatch = mainMessage.analyzed_content?.product_name?.toLowerCase().includes(searchLower);
            const vendorMatch = mainMessage.analyzed_content?.vendor_uid?.toLowerCase().includes(searchLower);
            
            if (!captionMatch && !productMatch && !vendorMatch) return false;
          }
          
          // Processing state filter
          if (filters.processingStates.length > 0) {
            if (!mainMessage.processing_state || 
              !filters.processingStates.includes(mainMessage.processing_state as ProcessingState)) {
              return false;
            }
          }
          
          // Date range filter
          if (filters.dateRange) {
            const messageDate = new Date(mainMessage.created_at);
            if (messageDate < filters.dateRange.from || messageDate > filters.dateRange.to) {
              return false;
            }
          }
          
          // Media type filter
          if (filters.mediaTypes.length > 0) {
            const mediaType = mainMessage.mime_type?.split('/')[0] || 'unknown';
            if (!filters.mediaTypes.includes(mediaType)) {
              return false;
            }
          }
          
          // Vendor filter
          if (filters.vendors.length > 0) {
            const vendor = mainMessage.analyzed_content?.vendor_uid;
            if (!vendor || !filters.vendors.includes(vendor)) {
              return false;
            }
          }
          
          // Chat source filter
          if (filters.chatSources.length > 0) {
            const chatSource = `${mainMessage.chat_id}-${mainMessage.chat_type}`;
            if (!filters.chatSources.includes(chatSource)) {
              return false;
            }
          }
          
          return true;
        } catch (err) {
          console.error('Error filtering group:', err);
          return false;
        }
      });
    } catch (err) {
      console.error('Error in filteredMessages:', err);
      return [];
    }
  }, [mediaGroups, filters]);

  // Calculate pagination
  const paginatedMessages = useMemo(() => {
    try {
      const startIndex = (filters.page - 1) * filters.itemsPerPage;
      return filteredMessages.slice(startIndex, startIndex + filters.itemsPerPage);
    } catch (err) {
      console.error('Error in paginatedMessages:', err);
      return [];
    }
  }, [filteredMessages, filters.page, filters.itemsPerPage]);

  // Handle message selection
  const handleMessageSelect = (message: Message) => {
    setSelectedMessage(message);
    
    // Open the details panel if it's not already open
    if (!detailsOpen) {
      setDetailsOpen(true);
    }
    
    // Log the selection
    logEvent(
      LogEventType.USER_ACTION,
      message.id,
      {
        action: 'select_message',
        message_id: message.id,
        view_type: filters.view
      }
    );
  };

  // Handle message view
  const handleMessageView = (messageGroup: Message[]) => {
    if (!messageGroup || messageGroup.length === 0) return;
    
    setCurrentGroup(messageGroup);
    setViewerOpen(true);
    
    // Find the index of the current group
    const index = filteredMessages.findIndex(group => 
      group[0] && messageGroup[0] && group[0].id === messageGroup[0].id
    );
    
    if (index !== -1) {
      setGroupIndex(index);
    }
    
    // Log the view
    logEvent(
      LogEventType.USER_ACTION,
      messageGroup[0].id,
      {
        action: 'view_message_group',
        group_size: messageGroup.length,
        media_group_id: messageGroup[0].media_group_id
      }
    );
  };

  // Handle viewer navigation
  const handlePreviousGroup = () => {
    if (groupIndex > 0) {
      const prevIndex = groupIndex - 1;
      const prevGroup = filteredMessages[prevIndex];
      setCurrentGroup(prevGroup);
      setGroupIndex(prevIndex);
    }
  };

  const handleNextGroup = () => {
    if (groupIndex < filteredMessages.length - 1) {
      const nextIndex = groupIndex + 1;
      const nextGroup = filteredMessages[nextIndex];
      setCurrentGroup(nextGroup);
      setGroupIndex(nextIndex);
    }
  };

  // Handle refresh
  const handleDataRefresh = async () => {
    try {
      await refetch();
      await handleRefresh();
      await refreshData();
      
      toast({
        title: "Data refreshed",
        description: `${filteredMessages.length} messages loaded`
      });
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh message data",
        variant: "destructive"
      });
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['media-groups'] });
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          queryClient.invalidateQueries({ queryKey: ['message-analytics'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Subscribe to unified_audit_logs for real-time updates on operations
  useEffect(() => {
    const channel = supabase
      .channel('audit-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unified_audit_logs'
        },
        (payload) => {
          console.log('Audit log update received:', payload);
          // We could show a notification or update specific parts of the UI based on log type
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleEditMessage = (message: Message) => {
    setEditDialogMessage(message);
    setIsEditDialogOpen(true);
  };

  const handleDeleteMessage = (message: Message) => {
    setSelectedMessage(message);
    setIsDeleteDialogOpen(true);
  };

  // If there's a critical error, show error state
  if (errorState) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-700 mb-2">Error Loading Messages</h3>
          <p className="text-red-600 mb-4">{errorState.message}</p>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <EnhancedMessagesHeader 
        title="Enhanced Messages"
        totalMessages={filteredMessages.length}
        onRefresh={handleDataRefresh}
        isLoading={isLoading}
      />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sheet open={filtersVisible} onOpenChange={setFiltersVisible}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {(filters.search || 
                  filters.processingStates.length > 0 || 
                  filters.vendors.length > 0 || 
                  filters.mediaTypes.length > 0 || 
                  filters.dateRange) && (
                  <Badge variant="secondary" className="ml-1">
                    {(filters.search ? 1 : 0) + 
                     filters.processingStates.length + 
                     filters.vendors.length + 
                     filters.mediaTypes.length + 
                     (filters.dateRange ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[350px] sm:w-[450px]">
              <EnhancedFiltersPanel />
            </SheetContent>
          </Sheet>
          
          <Button 
            variant="outline" 
            size="sm" 
            className={cn("gap-2", analyticsOpen ? "bg-secondary" : "")}
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          
          <Tabs 
            defaultValue={filters.view} 
            className="w-auto" 
            onValueChange={(value) => setFilters({ ...filters, view: value as 'grid' | 'list' })}
          >
            <TabsList className="h-9">
              <TabsTrigger value="grid" className="px-3">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="list" className="px-3">
                <LayoutList className="h-4 w-4 mr-2" />
                List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className={cn("gap-2", detailsOpen ? "bg-secondary" : "")}
          onClick={() => setDetailsOpen(!detailsOpen)}
        >
          <PanelRight className="h-4 w-4" />
          Details
        </Button>
      </div>
      
      <div className="flex">
        {/* Analytics panel - conditionally rendered */}
        {analyticsOpen && (
          <div className="w-72 mr-6 border rounded-md p-4 h-[calc(100vh-12rem)] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Analytics</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setAnalyticsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {analyticsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <MessageAnalyticsPanel data={analyticsData} />
            )}
          </div>
        )}
        
        {/* Main content area */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <h3 className="text-xl font-semibold mb-2">Error loading messages</h3>
              <p className="text-muted-foreground mb-4">{String(error)}</p>
              <Button onClick={handleDataRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-xl font-semibold mb-2">No messages found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or refreshing the data.</p>
            </div>
          ) : (
            <Tabs value={filters.view} className="w-full">
              <TabsContent value="grid" className="mt-0">
                <MessageGridView 
                  messages={paginatedMessages} 
                  onSelect={handleMessageSelect}
                  onView={handleMessageView}
                  selectedId={selectedMessage?.id}
                />
              </TabsContent>
              <TabsContent value="list" className="mt-0">
                <MessageListView 
                  messages={paginatedMessages}
                  onSelect={handleMessageSelect}
                  onView={handleMessageView}
                  selectedId={selectedMessage?.id}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
        
        {/* Details panel - conditionally rendered */}
        {detailsOpen && (
          <div className="col-span-1 xl:col-span-2 h-[calc(100vh-12rem)]">
            {selectedMessage && (
              <MessageDetailsPanel 
                message={selectedMessage} 
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
              />
            )}
          </div>
        )}
      </div>
      
      {/* Media Viewer Dialog */}
      <MediaViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        currentGroup={currentGroup}
        onPrevious={handlePreviousGroup}
        onNext={handleNextGroup}
        hasPrevious={groupIndex > 0}
        hasNext={groupIndex < filteredMessages.length - 1}
      />
    </div>
  );
};

export default MessagesEnhanced;
