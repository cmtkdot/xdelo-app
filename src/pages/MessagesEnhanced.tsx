
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { useMessageViewHandlers } from '@/hooks/useMessageViewHandlers';
import { MessagesLayout } from '@/components/EnhancedMessages/MessagesLayout';
import { MessageFiltersHeader } from '@/components/EnhancedMessages/MessageFiltersHeader';
import { MessageContent } from '@/components/EnhancedMessages/MessageContent';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useFilteredMessages } from '@/hooks/useFilteredMessages';
import { ResponsiveContainer } from '@/components/ui/responsive-container';
import { useIsMobile } from '@/hooks/useMobile';
import { EnhancedMessagesHeader } from '@/components/EnhancedMessages/EnhancedMessagesHeader';

const MessagesEnhanced = () => {
  const { 
    detailsOpen = false, 
    analyticsOpen = false,
    toggleView,
    currentView
  } = useMessagesStore() || {};
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { filteredMessages, refetch, isLoading, total } = useFilteredMessages() || {};
  const isMobile = useIsMobile();
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  
  // Setup handlers for message interactions
  const {
    viewerState,
    handleMessageSelect,
    handleMessageView,
    handlePreviousGroup,
    handleNextGroup,
    handleEditMessage,
    handleDeleteMessage
  } = useMessageViewHandlers() || {};
  
  // Setup realtime updates
  useRealtimeUpdates({
    tables: ['messages', 'unified_audit_logs'],
    onUpdate: () => {
      console.log('Real-time update received');
      queryClient.invalidateQueries({ queryKey: ['enhanced-messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-analytics'] });
    }
  });

  // Handle data refresh
  const handleDataRefresh = async () => {
    try {
      if (refetch) {
        await refetch();
        
        toast({
          title: "Data refreshed",
          description: "Messages have been refreshed"
        });
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        title: "Refresh failed",
        description: "Could not refresh message data",
        variant: "destructive"
      });
    }
  };

  const toggleFiltersPanel = () => {
    setFiltersPanelOpen(prev => !prev);
  };

  return (
    <ResponsiveContainer 
      mobilePadding={isMobile ? "sm" : "md"}
      className="py-4 space-y-4 bg-background"
      maxWidth="full"
    >
      {/* Header with refresh button */}
      <EnhancedMessagesHeader
        title="Enhanced Messages"
        totalMessages={total || 0}
        onRefresh={handleDataRefresh}
        isLoading={isLoading}
        onToggleFilters={toggleFiltersPanel}
        onToggleView={toggleView}
        currentView={currentView || 'grid'}
        filtersCount={0}
      />
      
      {/* Filter header with basic controls */}
      <MessageFiltersHeader 
        onRefresh={handleDataRefresh} 
        isFiltersPanelOpen={filtersPanelOpen}
        onToggleFiltersPanel={toggleFiltersPanel}
      />
      
      {/* Main content area with filters, message grid/list, and panels */}
      <MessagesLayout 
        detailsOpen={detailsOpen}
        analyticsOpen={analyticsOpen}
      >
        <MessageContent 
          onSelect={handleMessageSelect}
          onView={handleMessageView}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
        />
      </MessagesLayout>
      
      {/* Media viewer modal */}
      {viewerState?.isOpen && viewerState.Viewer}
    </ResponsiveContainer>
  );
};

export default MessagesEnhanced;
