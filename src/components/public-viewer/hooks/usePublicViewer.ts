
import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';

interface PublicViewerState {
  isOpen: boolean;
  currentGroup: Message[];
  groupIndex: number;
  itemIndex: number;
}

export function usePublicViewer(messageGroups: Message[][] = []) {
  const [state, setState] = useState<PublicViewerState>({
    isOpen: false,
    currentGroup: [],
    groupIndex: -1,
    itemIndex: 0
  });

  // Open the viewer with a specific message group
  const openViewer = useCallback((group: Message[], initialIndex = 0) => {
    if (!group || group.length === 0) return;
    
    let groupIndex = -1;
    
    // Find the group in our groups array
    if (messageGroups.length > 0) {
      for (let i = 0; i < messageGroups.length; i++) {
        if (messageGroups[i].some(item => group.some(g => g.id === item.id))) {
          groupIndex = i;
          break;
        }
      }
    }
    
    setState({
      isOpen: true,
      currentGroup: group,
      groupIndex: groupIndex >= 0 ? groupIndex : 0,
      itemIndex: initialIndex >= 0 && initialIndex < group.length ? initialIndex : 0
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
        groupIndex: prevIndex,
        itemIndex: 0
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
        groupIndex: nextIndex,
        itemIndex: 0
      });
    }
  }, [state.groupIndex, messageGroups]);

  // Share functionality
  const shareCurrentItem = useCallback((mediaItem: Message, shareType: 'telegram' | 'direct') => {
    if (!mediaItem) return;
    
    let shareUrl = '';
    
    if (shareType === 'telegram' && mediaItem.chat_id && mediaItem.telegram_message_id) {
      const chatId = mediaItem.chat_id.toString().replace('-100', '');
      shareUrl = `https://t.me/c/${chatId}/${mediaItem.telegram_message_id}`;
    } else if (shareType === 'direct' && mediaItem.public_url) {
      shareUrl = mediaItem.public_url;
    }
    
    if (shareUrl) {
      try {
        if (navigator.share) {
          navigator.share({
            title: mediaItem.caption || 'Shared media',
            url: shareUrl
          });
        } else {
          window.open(shareUrl, '_blank');
        }
      } catch (error) {
        console.error('Error sharing content:', error);
        window.open(shareUrl, '_blank');
      }
    }
  }, []);

  return {
    isOpen: state.isOpen,
    currentGroup: state.currentGroup,
    groupIndex: state.groupIndex,
    itemIndex: state.itemIndex,
    hasNext: state.groupIndex < messageGroups.length - 1 && state.groupIndex >= 0,
    hasPrevious: state.groupIndex > 0,
    openViewer,
    closeViewer,
    goToNextGroup,
    goToPreviousGroup,
    shareCurrentItem
  };
}
