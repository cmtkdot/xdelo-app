
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
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';
import { MediaCarousel, MediaCarouselItem } from './MediaCarousel';
import { MediaDisplay } from './MediaDisplay';
import { MediaToolbar, MediaToolbarAction } from './MediaToolbar';

export interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  items: MediaCarouselItem[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  toolbar?: {
    primaryActions?: MediaToolbarAction[];
    secondaryActions?: MediaToolbarAction[];
  };
  sidePanel?: React.ReactNode;
  className?: string;
}

export function MediaViewer({
  isOpen,
  onClose,
  items = [],
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  toolbar,
  sidePanel,
  className
}: MediaViewerProps) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [showTools, setShowTools] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const isMobile = useIsMobile();
  
  // Ensure we have valid data
  if (!items || !Array.isArray(items) || items.length === 0) {
    return null;
  }
  
  // Get the currently active media item
  const currentItem = items[activeMediaIndex];
  
  const handleMediaChange = (index: number) => {
    setActiveMediaIndex(index);
  };

  const handleToggleTools = () => {
    setShowTools(!showTools);
  };

  const handleToggleDetails = () => {
    setShowDetails(!showDetails);
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
            {sidePanel}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );

  const renderMediaItem = (item: MediaCarouselItem) => (
    <MediaDisplay 
      url={item.public_url} 
      mimeType={item.mime_type}
      caption={item.caption}
      type={item.type}
      className="max-h-[85vh] md:max-h-[85vh]"
    />
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
          !isMobile && sidePanel ? "md:w-3/5" : "w-full"
        )}>
          {/* Media display area */}
          <div className="flex-grow overflow-hidden relative">
            <MediaCarousel 
              items={items}
              activeIndex={activeMediaIndex}
              onIndexChange={handleMediaChange}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
              onPrevious={onPrevious}
              onNext={onNext}
              renderItem={renderMediaItem}
            />
            
            {/* Mobile-only detail sheet trigger at bottom of screen */}
            {isMobile && sidePanel && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <MobileDetailsSheet />
              </div>
            )}
          </div>
          
          {/* Toolbar with actions */}
          {toolbar && (
            <MediaToolbar 
              primaryActions={toolbar.primaryActions}
              secondaryActions={toolbar.secondaryActions}
            />
          )}
        </div>
        
        {/* Right column: Side panel (desktop only) */}
        {!isMobile && sidePanel && (
          <div className="border-t md:border-t-0 md:border-l bg-background/95 w-full md:w-2/5 h-full">
            <ScrollArea className="h-full">
              <div className="p-4">
                {sidePanel}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
