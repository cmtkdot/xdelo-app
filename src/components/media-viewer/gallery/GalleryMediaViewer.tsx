
import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { X, Info, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMobile';
import { GalleryToolbar } from './GalleryToolbar';
import { GalleryMediaCarousel } from './GalleryMediaCarousel';
import { getMainMediaFromGroup } from '../utils';
import { ProductDetails } from '../shared/ProductDetails';
import { BaseMediaViewerProps } from '../types';

export function GalleryMediaViewer({
  isOpen,
  onClose,
  currentGroup = [],
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  className
}: BaseMediaViewerProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showTools, setShowTools] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();
  
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

  // Mobile detail drawer component
  const MobileDetailsSheet = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 bg-background/40 hover:bg-background/60 rounded-full px-3 py-1"
        >
          <Info className="h-4 w-4" />
          <span>Details</span>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] pt-8 rounded-t-xl">
        <SheetClose className="absolute right-4 top-4 z-50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetClose>
        <ScrollArea className="h-full py-1">
          <div className="p-4">
            <ProductDetails mainMedia={mainMedia} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "p-0 max-w-6xl w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col md:flex-row gap-0 bg-background/95 backdrop-blur-md", 
          className
        )}
      >
        {/* Close button positioned absolutely in top-right */}
        <DialogClose className="absolute right-4 top-4 z-50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-background/40 hover:bg-background/60"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>

        {/* Left column: Media display */}
        <div className={cn(
          "w-full flex flex-col h-full",
          !isMobile && "md:w-3/5"
        )}>
          {/* Media display area */}
          <div className="flex-grow overflow-hidden relative">
            <GalleryMediaCarousel 
              mediaItems={currentGroup}
              activeIndex={activeMediaIndex}
              onIndexChange={handleMediaChange}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              onPrevious={onPrevious}
              onNext={onNext}
            />
            
            {/* Mobile-only detail sheet trigger at bottom of screen */}
            {isMobile && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <MobileDetailsSheet />
              </div>
            )}
          </div>
          
          {/* Toolbar with actions */}
          <GalleryToolbar 
            currentMedia={currentMedia}
            showTools={showTools}
            onToggleTools={handleToggleTools} 
            messageIds={messageIds}
          />
        </div>
        
        {/* Right column: Product information (desktop only) */}
        {!isMobile && (
          <div className="border-t md:border-t-0 md:border-l bg-background/95 w-full md:w-2/5 h-full">
            <ScrollArea className="h-full">
              <div className="p-4">
                <ProductDetails mainMedia={mainMedia} />
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
