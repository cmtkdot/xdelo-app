
import { useState } from 'react';
import { Message, LogEventType } from '@/types';
import { logEvent } from '@/lib/logUtils';
import { useMessagesStore } from './useMessagesStore';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { useFilteredMessages } from './useFilteredMessages';

export interface ViewerState {
  isOpen: boolean;
  currentGroup: Message[];
  groupIndex: number;
  Viewer: React.ReactNode;
}

export function useMessageViewHandlers() {
  const { 
    selectedMessage, 
    setSelectedMessage,
    setDetailsOpen
  } = useMessagesStore();
  
  const { filteredMessages } = useFilteredMessages();

  // Viewer state
  const [viewerState, setViewerState] = useState<ViewerState>({
    isOpen: false,
    currentGroup: [],
    groupIndex: 0,
    Viewer: null
  });
  
  // Message selection
  const handleMessageSelect = (message: Message) => {
    setSelectedMessage(message);
    
    if (!setDetailsOpen) return;
    setDetailsOpen(true);
    
    logEvent(
      LogEventType.USER_ACTION,
      message.id,
      {
        action: 'select_message',
        message_id: message.id
      }
    );
  };

  // Message viewing in modal
  const handleMessageView = (messageGroup: Message[]) => {
    if (!messageGroup || !Array.isArray(messageGroup) || messageGroup.length === 0) {
      console.warn('Invalid message group provided to handleMessageView');
      return;
    }
    
    let currentIndex = 0;
    
    if (filteredMessages) {
      const index = filteredMessages.findIndex(group => 
        group && Array.isArray(group) && group.length > 0 && 
        messageGroup[0] && group[0].id === messageGroup[0].id
      );
      
      if (index !== -1) {
        currentIndex = index;
      }
    }
    
    setViewerState({
      isOpen: true,
      currentGroup: messageGroup,
      groupIndex: currentIndex,
      Viewer: (
        <MediaViewer
          isOpen={true}
          onClose={() => setViewerState(prev => ({ ...prev, isOpen: false }))}
          currentGroup={messageGroup}
          onNext={handleNextGroup}
          onPrevious={handlePreviousGroup}
          hasNext={filteredMessages && Array.isArray(filteredMessages) && currentIndex < filteredMessages.length - 1}
          hasPrevious={currentIndex > 0}
        />
      )
    });
    
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

  // Navigation within viewer
  const handlePreviousGroup = () => {
    if (filteredMessages && Array.isArray(filteredMessages) && viewerState.groupIndex > 0) {
      const prevIndex = viewerState.groupIndex - 1;
      const prevGroup = filteredMessages[prevIndex];
      
      if (prevGroup && Array.isArray(prevGroup) && prevGroup.length > 0) {
        setViewerState(prev => ({
          ...prev,
          currentGroup: [...prevGroup],
          groupIndex: prevIndex,
          Viewer: (
            <MediaViewer
              isOpen={true}
              onClose={() => setViewerState(prev => ({ ...prev, isOpen: false }))}
              currentGroup={[...prevGroup]}
              onNext={handleNextGroup}
              onPrevious={handlePreviousGroup}
              hasNext={filteredMessages.length > prevIndex + 1}
              hasPrevious={prevIndex > 0}
            />
          )
        }));
      }
    }
  };

  const handleNextGroup = () => {
    if (filteredMessages && Array.isArray(filteredMessages) && viewerState.groupIndex < filteredMessages.length - 1) {
      const nextIndex = viewerState.groupIndex + 1;
      const nextGroup = filteredMessages[nextIndex];
      
      if (nextGroup && Array.isArray(nextGroup) && nextGroup.length > 0) {
        setViewerState(prev => ({
          ...prev,
          currentGroup: [...nextGroup],
          groupIndex: nextIndex,
          Viewer: (
            <MediaViewer
              isOpen={true}
              onClose={() => setViewerState(prev => ({ ...prev, isOpen: false }))}
              currentGroup={[...nextGroup]}
              onNext={handleNextGroup}
              onPrevious={handlePreviousGroup}
              hasNext={filteredMessages.length > nextIndex + 1}
              hasPrevious={nextIndex > 0}
            />
          )
        }));
      }
    }
  };

  // Message editing and deletion
  const handleEditMessage = (message: Message) => {
    setSelectedMessage(message);
    // The actual edit dialog would be handled elsewhere
  };

  const handleDeleteMessage = (message: Message) => {
    setSelectedMessage(message);
    // The actual delete confirmation would be handled elsewhere
  };

  return {
    viewerState,
    handleMessageSelect,
    handleMessageView,
    handlePreviousGroup,
    handleNextGroup,
    handleEditMessage,
    handleDeleteMessage
  };
}
