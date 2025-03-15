
import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';

interface MediaViewerState {
  isOpen: boolean;
  currentGroup: Message[];
  groupIndex: number;
}

export function useMediaViewer(messageGroups: Message[][] = []) {
  const [state, setState] = useState<MediaViewerState>({
    isOpen: false,
    currentGroup: [],
    groupIndex: -1
  });

  // Open the viewer with a specific message group
  const openViewer = useCallback((group: Message[], index: number = -1) => {
    if (!group || group.length === 0) return;
    
    let groupIndex = index;
    
    // If index wasn't provided, try to find the group in our groups array
    if (index === -1 && messageGroups.length > 0) {
      groupIndex = messageGroups.findIndex(g => 
        g.length > 0 && group.length > 0 && g[0].id === group[0].id
      );
    }
    
    setState({
      isOpen: true,
      currentGroup: group,
      groupIndex: groupIndex >= 0 ? groupIndex : 0
    });
  }, [messageGroups]);

  // Close the viewer
  const closeViewer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Navigate to previous group
  const goToPreviousGroup = useCallback(() => {
    if (state.groupIndex <= 0 || !messageGroups.length) return;
    
    const prevIndex = state.groupIndex - 1;
    const prevGroup = messageGroups[prevIndex];
    
    if (prevGroup && prevGroup.length > 0) {
      setState({
        isOpen: true,
        currentGroup: prevGroup,
        groupIndex: prevIndex
      });
    }
  }, [state.groupIndex, messageGroups]);

  // Navigate to next group
  const goToNextGroup = useCallback(() => {
    if (state.groupIndex < 0 || state.groupIndex >= messageGroups.length - 1) return;
    
    const nextIndex = state.groupIndex + 1;
    const nextGroup = messageGroups[nextIndex];
    
    if (nextGroup && nextGroup.length > 0) {
      setState({
        isOpen: true,
        currentGroup: nextGroup,
        groupIndex: nextIndex
      });
    }
  }, [state.groupIndex, messageGroups]);

  return {
    isOpen: state.isOpen,
    currentGroup: state.currentGroup,
    groupIndex: state.groupIndex,
    hasNext: state.groupIndex < messageGroups.length - 1 && state.groupIndex >= 0,
    hasPrevious: state.groupIndex > 0,
    openViewer,
    closeViewer,
    goToNextGroup,
    goToPreviousGroup
  };
}
