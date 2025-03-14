
import { useState } from 'react';
import { Message } from '@/types/entities/Message';
import { ExternalLink, FileDown, Settings } from 'lucide-react';
import { MediaToolbarAction } from '@/components/shared/media/MediaToolbar';
import { MediaCarouselItem } from '@/components/shared/media/MediaCarousel';
import { messageToMediaItem, getTelegramMessageUrl } from '@/lib/mediaUtils';
import { MediaFixButton } from '@/components/MediaViewer/MediaFixButton';

export function useMessageViewer() {
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    currentGroup: Message[];
    currentIndex: number;
    mediaGroups: Message[][];
  } | null>(null);

  // Convert Message[] to MediaCarouselItem[]
  const convertToCarouselItems = (messages: Message[]): MediaCarouselItem[] => {
    return messages.map(message => ({
      id: message.id,
      public_url: message.public_url,
      mime_type: message.mime_type,
      caption: message.caption,
      type: message.mime_type?.startsWith('image/') ? 'image' : 
           message.mime_type?.startsWith('video/') ? 'video' : 
           message.mime_type?.startsWith('audio/') ? 'audio' : 
           message.mime_type?.startsWith('application/') ? 'document' : 'unknown'
    }));
  };

  // Create toolbar actions for a message group
  const createToolbarActions = (messages: Message[]): {
    primaryActions: MediaToolbarAction[];
    secondaryActions: MediaToolbarAction[];
  } => {
    if (!messages || messages.length === 0) {
      return { primaryActions: [], secondaryActions: [] };
    }

    const mainMessage = messages[0];
    const telegramUrl = getTelegramMessageUrl(mainMessage);
    const publicUrl = mainMessage.public_url;
    const messageIds = messages.map(m => m.id).filter(Boolean);

    const primaryActions: MediaToolbarAction[] = [];
    const secondaryActions: MediaToolbarAction[] = [];

    // Download action
    if (publicUrl) {
      primaryActions.push({
        id: 'download',
        label: 'Download',
        icon: <FileDown className="h-4 w-4" />,
        tooltip: 'Download media',
        onClick: () => {
          const a = document.createElement('a');
          a.href = publicUrl;
          a.download = publicUrl.split('/').pop() || 'download';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
    }

    // Open in Telegram action
    if (telegramUrl) {
      primaryActions.push({
        id: 'telegram',
        label: 'Open in Telegram',
        icon: <ExternalLink className="h-4 w-4" />,
        tooltip: 'View original in Telegram',
        onClick: () => window.open(telegramUrl, '_blank')
      });
    }

    // Tools action
    if (messageIds.length > 0) {
      secondaryActions.push({
        id: 'tools',
        label: 'Tools',
        icon: <Settings className="h-4 w-4" />,
        tooltip: 'Media repair tools',
        onClick: () => {
          // Here you would implement the tools functionality
          // For now, just log the message IDs
          console.log('Media repair tools for:', messageIds);
        }
      });
    }

    return { primaryActions, secondaryActions };
  };

  // Open the viewer with a specific group of messages
  const openViewer = (group: Message[], allGroups?: Message[][]) => {
    if (!group || group.length === 0) return;

    const mediaGroups = allGroups || [group];
    const groupIndex = mediaGroups.findIndex(g => g[0]?.id === group[0]?.id);

    setViewerState({
      isOpen: true,
      currentGroup: group,
      currentIndex: Math.max(0, groupIndex),
      mediaGroups
    });
  };

  // Close the viewer
  const closeViewer = () => {
    setViewerState(null);
  };

  // Navigate to the previous group
  const previousGroup = () => {
    if (!viewerState) return;
    const { currentIndex, mediaGroups } = viewerState;
    
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setViewerState({
        ...viewerState,
        currentGroup: mediaGroups[newIndex],
        currentIndex: newIndex
      });
    }
  };

  // Navigate to the next group
  const nextGroup = () => {
    if (!viewerState) return;
    const { currentIndex, mediaGroups } = viewerState;
    
    if (currentIndex < mediaGroups.length - 1) {
      const newIndex = currentIndex + 1;
      setViewerState({
        ...viewerState,
        currentGroup: mediaGroups[newIndex],
        currentIndex: newIndex
      });
    }
  };

  return {
    viewerState,
    openViewer,
    closeViewer,
    previousGroup,
    nextGroup,
    convertToCarouselItems,
    createToolbarActions
  };
}
