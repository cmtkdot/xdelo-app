
'use client'

import React, { useState } from 'react';
import { Message } from '@/types/MessagesTypes';
import { 
  Dialog, 
  DialogContent, 
  DialogClose
} from '@/components/ui/dialog';
import { MediaCarousel } from './media-carousel';
import { MediaToolbar } from './media-toolbar';
import { ProductDetails } from './product-details';
import { cn } from '@/lib/utils';
import { getMainMediaFromGroup } from '@/components/MediaViewer/utils/mediaHelpers';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  className?: string;
}

export function MediaViewer({
  isOpen,
  onClose,
  currentGroup = [],
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  className
}: MediaViewerProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showTools, setShowTools] = useState(false);
  
  // Ensure we have valid data
  if (!currentGroup || !Array.isArray(currentGroup) || currentGroup.length === 0) {
    return null;
  }

  // Get the main media item (either the one with caption or the first one)
  const mainMedia = getMainMediaFromGroup(currentGroup);
  
  // Get the currently active media item
  const currentMedia = currentGroup[activeMediaIndex] || mainMedia;
  
  // Find all message IDs for repair tools
  const messageIds = currentGroup.map(message => message?.id).filter(Boolean);
  
  const handleMediaChange = (index: number) => {
    setActiveMediaIndex(index);
  };

  const handleToggleTools = () => {
    setShowTools(!showTools);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "p-0 max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col md:flex-row",
          className
        )}
      >
        {/* Close button positioned absolutely in top-right */}
        <DialogClose className="absolute right-4 top-4 z-50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>

        {/* Left column: Media display */}
        <div className="w-full md:w-3/5 flex flex-col h-full">
          {/* Media display area */}
          <div className="flex-grow overflow-hidden bg-black">
            <MediaCarousel 
              mediaItems={currentGroup}
              activeIndex={activeMediaIndex}
              onIndexChange={handleMediaChange}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              onPrevious={onPrevious}
              onNext={onNext}
            />
          </div>
          
          {/* Toolbar with actions */}
          <MediaToolbar 
            currentMedia={currentMedia}
            showTools={showTools}
            onToggleTools={handleToggleTools} 
            messageIds={messageIds}
          />
        </div>
        
        {/* Right column: Product information */}
        <div className="w-full md:w-2/5 border-t md:border-t-0 md:border-l h-[40vh] md:h-full">
          <ScrollArea className="h-full">
            <div className="p-4">
              <ProductDetails mainMedia={mainMedia} />
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
