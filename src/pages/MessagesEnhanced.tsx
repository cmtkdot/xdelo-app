
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { useMessageViewHandlers } from '@/hooks/useMessageViewHandlers';
import { MessagesLayout } from '@/components/EnhancedMessages/MessagesLayout';
import { MessageFiltersHeader } from '@/components/EnhancedMessages/MessageFiltersHeader';
import { MessageContent } from '@/components/EnhancedMessages/MessageContent';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useFilteredMessages } from '@/hooks/useFilteredMessages';

const MessagesEnhanced = () => {
  const { 
    detailsOpen = false, 
    analyticsOpen = false
  } = useMessagesStore() || {};
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refetch } = useFilteredMessages() || {};
  
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with refresh button */}
      <MessageFiltersHeader onRefresh={handleDataRefresh} />
      
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
    </div>
  );
};

export default MessagesEnhanced;
