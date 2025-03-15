
import React, { useState, useCallback, useEffect } from 'react';
import { Message } from '@/types/entities/Message';
import { GalleryMediaViewer } from '@/components/media-viewer/gallery/GalleryMediaViewer';
import { useMediaOperations } from './useMediaOperations';
import { useToast } from './useToast';

interface ViewerState {
  isOpen: boolean;
  currentGroup: Message[];
  groupIndex: number;
  Viewer: React.ReactNode;
}

export function useMessageViewHandlers() {
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);
  const [selectedItems, setSelectedItems] = useState<Message[]>([]);
  const { deleteMessage } = useMediaOperations();
  const { toast } = useToast();

  // Handle selecting messages (e.g., for bulk operations)
  const handleMessageSelect = useCallback((message: Message, selected: boolean) => {
    setSelectedItems(prev => {
      if (selected) {
        return [...prev, message];
      } else {
        return prev.filter(m => m.id !== message.id);
      }
    });
  }, []);

  // Handle viewing a message in the media viewer
  const handleMessageView = useCallback((group: Message[], index: number = 0) => {
    setViewerState({
      isOpen: true,
      currentGroup: group,
      groupIndex: index,
      Viewer: (
        <GalleryMediaViewer
          isOpen={true}
          onClose={() => setViewerState(null)}
          currentGroup={group}
          className="z-50"
        />
      )
    });
  }, []);

  // Handle navigation to previous message group
  const handlePreviousGroup = useCallback(() => {
    // This would typically come from a parent component's state
    console.log('Previous group navigation');
  }, []);

  // Handle navigation to next message group
  const handleNextGroup = useCallback(() => {
    // This would typically come from a parent component's state
    console.log('Next group navigation');
  }, []);

  // Handle editing a message
  const handleEditMessage = useCallback((message: Message) => {
    console.log('Edit message:', message);
  }, []);

  // Handle deleting a message
  const handleDeleteMessage = useCallback(async (message: Message) => {
    try {
      await deleteMessage(message.id);
      toast({
        title: "Message deleted",
        description: "The message has been successfully deleted"
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Delete failed",
        description: "There was an error deleting the message",
        variant: "destructive"
      });
    }
  }, [deleteMessage, toast]);

  return {
    viewerState,
    selectedItems,
    handleMessageSelect,
    handleMessageView,
    handlePreviousGroup,
    handleNextGroup,
    handleEditMessage,
    handleDeleteMessage
  };
}
