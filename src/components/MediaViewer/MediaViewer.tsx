
import React, { useState } from 'react';
import { Message } from '@/types/MessagesTypes';
import { MediaItem } from '@/types';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ResponsiveContainer } from "@/components/ui/responsive-container";
import { MediaDisplay } from './components/MediaDisplay';
import { MediaControls } from './components/MediaControls';
import { ProductInfo } from './components/ProductInfo';
import { MediaFixButton } from './MediaFixButton';
import { messageToMediaItem, getTelegramMessageUrl, getMainMediaFromGroup } from './utils/mediaHelpers';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  editMode?: boolean;
}

export const MediaViewer = ({
  isOpen,
  onClose,
  currentGroup = [], 
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  editMode = false
}: MediaViewerProps) => {
  const [showTools, setShowTools] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Guard against null or undefined currentGroup
  if (!currentGroup || !Array.isArray(currentGroup) || currentGroup.length === 0) {
    return null;
  }

  const mainMedia = getMainMediaFromGroup(currentGroup);
  const currentMedia = currentGroup?.[activeMediaIndex] || mainMedia;
  
  // Convert messages to media items for display
  const mediaItems: MediaItem[] = Array.isArray(currentGroup) 
    ? currentGroup.map(message => message ? messageToMediaItem(message) : null).filter(Boolean) as MediaItem[]
    : [];
  
  // Get message IDs for repair tools
  const messageIds = Array.isArray(currentGroup) ? currentGroup.map(message => message?.id).filter(Boolean) : [];
  
  // Get URLs for external links
  const telegramUrl = getTelegramMessageUrl(currentMedia);
  const publicUrl = currentMedia?.public_url || null;

  // Handlers
  const handleMediaChange = (index: number) => {
    setActiveMediaIndex(index);
  };

  const handleToolsToggle = () => {
    setShowTools(!showTools);
  };

  const handleToolsComplete = () => {
    setShowTools(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 md:max-h-[90vh] h-[100vh] md:h-auto overflow-hidden">
        <div className="relative flex flex-col bg-background dark:bg-background h-full overflow-hidden">
          {/* Top navigation controls */}
          <MediaControls
            onClose={onClose}
            onPrevious={onPrevious}
            onNext={onNext}
            onShowTools={handleToolsToggle}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            telegramUrl={telegramUrl}
            publicUrl={publicUrl}
          />
          
          {/* Media display area */}
          <MediaDisplay 
            mediaItems={mediaItems}
            onMediaChange={handleMediaChange}
            initialIndex={activeMediaIndex}
          />
          
          {/* Tools area - conditionally shown */}
          {showTools && (
            <div className="p-2 border-t bg-muted/10 flex justify-center">
              <MediaFixButton messageIds={messageIds} onComplete={handleToolsComplete} />
            </div>
          )}
          
          {/* Product information area */}
          <ResponsiveContainer mobilePadding="sm">
            {mainMedia && <ProductInfo mainMedia={mainMedia} />}
          </ResponsiveContainer>
        </div>
      </DialogContent>
    </Dialog>
  );
};
