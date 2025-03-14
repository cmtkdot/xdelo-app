
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Message, ProcessingState, LogEventType } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useEnhancedMessages } from '@/hooks/useEnhancedMessages';
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
  RefreshCw
} from 'lucide-react';
import { EnhancedMessagesHeader } from '@/components/EnhancedMessages/EnhancedMessagesHeader';
import { MessageGridView } from '@/components/EnhancedMessages/MessageGridView';
import { MessageListView } from '@/components/EnhancedMessages/MessageListView';
import { EnhancedFiltersPanel } from '@/components/EnhancedMessages/EnhancedFiltersPanel';
import { MessageDetailsPanel } from '@/components/EnhancedMessages/MessageDetailsPanel';
import { MessageAnalyticsPanel } from '@/components/EnhancedMessages/MessageAnalyticsPanel';
import { useMessageAnalytics } from '@/hooks/useMessageAnalytics';
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
  const { 
    filters, setFilters,
    selectedMessage, setSelectedMessage,
    detailsOpen, setDetailsOpen,
    analyticsOpen, setAnalyticsOpen,
    refreshData 
  } = useMessagesStore();

  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<Message[]>([]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [editDialogMessage, setEditDialogMessage] = useState<Message | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Use useEnhancedMessages hook instead of mediaGroupsData
  const { 
    groupedMessages: mediaGroups, 
    isLoading, 
    error, 
    refetch,
    isRefetching
  } = useEnhancedMessages({
    grouped: true,
    limit: 500,
    processingStates: filters.processingStates,
    searchTerm: filters.search,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder
  });
  
  const { messages: realtimeMessages, handleRefresh } = useRealTimeMessages({
    limit: 100,
    processingState: filters.processingStates,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder
  });
  
  const { data: analyticsData, isLoading: analyticsLoading } = useMessageAnalytics();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filteredMessages = useMemo(() => {
    // Defensive check
    if (!Array.isArray(mediaGroups)) {
      console.warn('mediaGroups is not an array in filteredMessages', mediaGroups);
      return [] as Message[][];
    }
    
    // Additional logging for debugging
    console.log('Filtering mediaGroups:', 
      mediaGroups.length, 
      'groups. Is array:', Array.isArray(mediaGroups)
    );
    
    try {
      return mediaGroups.filter(group => {
        // Skip invalid groups
        if (!group || !Array.isArray(group) || group.length === 0) {
          return false;
        }
        
        const mainMessage = group[0];
        if (!mainMessage) return false;

        if (filters.search && mainMessage.caption) {
          const searchLower = filters.search.toLowerCase();
          const captionMatch = mainMessage.caption.toLowerCase().includes(searchLower);
          const productMatch = mainMessage.analyzed_content?.product_name?.toLowerCase().includes(searchLower);
          const vendorMatch = mainMessage.analyzed_content?.vendor_uid?.toLowerCase().includes(searchLower);
          
          if (!captionMatch && !productMatch && !vendorMatch) return false;
        }
        
        if (filters.processingStates.length > 0) {
          if (!mainMessage.processing_state || 
             !filters.processingStates.includes(mainMessage.processing_state as ProcessingState)) {
            return false;
          }
        }
        
        if (filters.dateRange) {
          const messageDate = new Date(mainMessage.created_at || '');
          if (messageDate < filters.dateRange.from || messageDate > filters.dateRange.to) {
            return false;
          }
        }
        
        if (filters.mediaTypes.length > 0) {
          const mediaType = mainMessage.mime_type?.split('/')[0] || 'unknown';
          if (!filters.mediaTypes.includes(mediaType)) {
            return false;
          }
        }
        
        if (filters.vendors.length > 0) {
          const vendor = mainMessage.analyzed_content?.vendor_uid;
          if (!vendor || !filters.vendors.includes(vendor)) {
            return false;
          }
        }
        
        if (filters.chatSources.length > 0) {
          const chatSource = `${mainMessage.chat_id}-${mainMessage.chat_type}`;
          if (!filters.chatSources.includes(chatSource)) {
            return false;
          }
        }
        
        return true;
      });
    } catch (err) {
      console.error('Error in filtering messages:', err);
      return [] as Message[][];
    }
  }, [mediaGroups, filters]);

  const paginatedMessages = useMemo(() => {
    // Defensive programming - ensure filteredMessages is valid
    if (!filteredMessages || !Array.isArray(filteredMessages)) {
      console.warn('filteredMessages is not an array in pagination', filteredMessages);
      return [] as Message[][];
    }
    
    if (filteredMessages.length === 0) {
      return [] as Message[][];
    }
    
    const startIndex = (filters.page - 1) * filters.itemsPerPage;
    return filteredMessages.slice(startIndex, startIndex + filters.itemsPerPage);
  }, [filteredMessages, filters.page, filters.itemsPerPage]);

  const handleMessageSelect = (message: Message) => {
    setSelectedMessage(message);
    
    if (!detailsOpen) {
      setDetailsOpen(true);
    }
    
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

  const handleMessageView = (messageGroup: Message[]) => {
    if (!messageGroup || !Array.isArray(messageGroup) || messageGroup.length === 0) {
      console.warn('Invalid message group provided to handleMessageView');
      return;
    }
    
    setCurrentGroup(messageGroup);
    setViewerOpen(true);
    
    if (filteredMessages) {
      const index = filteredMessages.findIndex(group => 
        group && Array.isArray(group) && group.length > 0 && 
        messageGroup[0] && group[0].id === messageGroup[0].id
      );
      
      if (index !== -1) {
        setGroupIndex(index);
      }
    }
    
    if (messageGroup[0]) {
      logEvent(
        LogEventType.USER_ACTION,
        messageGroup[0].id,
        {
          action: 'view_message_group',
          group_size: messageGroup.length,
          media_group_id: messageGroup[0].media_group_id
        }
      );
    }
  };

  const handlePreviousGroup = () => {
    if (filteredMessages && Array.isArray(filteredMessages) && groupIndex > 0) {
      const prevIndex = groupIndex - 1;
      const prevGroup = filteredMessages[prevIndex];
      
      if (prevGroup && Array.isArray(prevGroup) && prevGroup.length > 0) {
        setCurrentGroup([...prevGroup]);
        setGroupIndex(prevIndex);
      }
    }
  };

  const handleNextGroup = () => {
    if (filteredMessages && Array.isArray(filteredMessages) && groupIndex < filteredMessages.length - 1) {
      const nextIndex = groupIndex + 1;
      const nextGroup = filteredMessages[nextIndex];
      
      if (nextGroup && Array.isArray(nextGroup) && nextGroup.length > 0) {
        setCurrentGroup([...nextGroup]);
        setGroupIndex(nextIndex);
      }
    }
  };

  const handleDataRefresh = async () => {
    try {
      await refetch();
      await handleRefresh();
      await refreshData();
      
      toast({
        title: "Data refreshed",
        description: `${filteredMessages?.length || 0} messages loaded`
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

  const handleDeleteMessage = async (message: Message) => {
    setSelectedMessage(message);
    setIsDeleteDialogOpen(true);
  };

  // Debug log for troubleshooting
  useEffect(() => {
    console.log('mediaGroups type:', Array.isArray(mediaGroups) ? 'array' : typeof mediaGroups);
    console.log('mediaGroups length:', Array.isArray(mediaGroups) ? mediaGroups.length : 'N/A');
    console.log('filteredMessages length:', filteredMessages && Array.isArray(filteredMessages) ? filteredMessages.length : 'N/A');
    console.log('paginatedMessages length:', paginatedMessages && Array.isArray(paginatedMessages) ? paginatedMessages.length : 'N/A');
  }, [mediaGroups, filteredMessages, paginatedMessages]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <EnhancedMessagesHeader 
        title="Enhanced Messages"
        totalMessages={filteredMessages && Array.isArray(filteredMessages) ? filteredMessages.length : 0}
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
          ) : !filteredMessages || !Array.isArray(filteredMessages) || filteredMessages.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-xl font-semibold mb-2">No messages found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or refreshing the data.</p>
            </div>
          ) : (
            <Tabs value={filters.view} className="w-full">
              <TabsContent value="grid" className="mt-0">
                {paginatedMessages && Array.isArray(paginatedMessages) ? (
                  <MessageGridView 
                    messages={paginatedMessages} 
                    onSelect={handleMessageSelect}
                    onView={handleMessageView}
                    selectedId={selectedMessage?.id}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p>No messages to display</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="list" className="mt-0">
                {paginatedMessages && Array.isArray(paginatedMessages) ? (
                  <MessageListView 
                    messages={paginatedMessages}
                    onSelect={handleMessageSelect}
                    onView={handleMessageView}
                    selectedId={selectedMessage?.id}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p>No messages to display</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
        
        {detailsOpen && selectedMessage && (
          <div className="w-96 ml-6 border rounded-md p-4 h-[calc(100vh-12rem)] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Message Details</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setDetailsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <MessageDetailsPanel 
              message={selectedMessage} 
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
            />
          </div>
        )}
      </div>
      
      {viewerOpen && currentGroup && Array.isArray(currentGroup) && currentGroup.length > 0 && (
        <MediaViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          currentGroup={currentGroup}
          onNext={handleNextGroup}
          onPrevious={handlePreviousGroup}
          hasNext={filteredMessages && Array.isArray(filteredMessages) && groupIndex < filteredMessages.length - 1}
          hasPrevious={groupIndex > 0}
        />
      )}
    </div>
  );
};

export default MessagesEnhanced;
