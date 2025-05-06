import { MediaPlayer } from '@/components/common/MediaPlayer';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Message } from '@/types/message';
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PublicEnhancedMediaDetail } from './PublicEnhancedMediaDetail';

export interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  initialIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onDelete?: (messageId: string) => Promise<void>;
  onShare?: () => void;
  onShowOriginal?: () => void;
  className?: string;
}

export function PublicMediaViewer({
  isOpen,
  onClose,
  currentGroup,
  initialIndex = 0,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  onShare,
  onShowOriginal,
  className
}: MediaViewerProps) {
  // Check if we're on mobile or desktop using window width
  const [isMobile, setIsMobile] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get the current message to display based on the current index
  const currentMessage = currentGroup && currentGroup.length > 0 ? currentGroup[currentIndex] : null;

  // Update isMobile state based on window size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Set initial value
    checkMobile();

    // Add listener for window resize
    window.addEventListener('resize', checkMobile);

    // Clean up
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Navigate to previous/next image when requested
  useEffect(() => {
    setCurrentIndex(initialIndex);
    // Reset zoom when changing images
    setZoomLevel(1);
  }, [initialIndex, currentGroup]);

  // Touch handling for swipe gestures
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    // Determine swipe direction and minimum distance
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50; // Minimum distance to be considered a swipe

    if (distance > minSwipeDistance) {
      // Swiped left, go to next
      if (onNext && hasNext) onNext();
    } else if (distance < -minSwipeDistance) {
      // Swiped right, go to previous
      if (onPrevious && hasPrevious) onPrevious();
    }

    // Reset touch positions
    setTouchStart(null);
    setTouchEnd(null);
  }, [touchStart, touchEnd, onNext, onPrevious, hasNext, hasPrevious]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowLeft':
          if (onPrevious && hasPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (onNext && hasNext) onNext();
          break;
        case 'Escape':
          onClose();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case '+':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onPrevious, onNext, hasPrevious, hasNext, onClose]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  // Auto-hide controls after inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeout);
      setShowControls(true);

      timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    if (isOpen) {
      resetTimeout();

      const container = containerRef.current;
      if (container) {
        container.addEventListener('mousemove', resetTimeout);
        container.addEventListener('touchstart', resetTimeout);

        return () => {
          clearTimeout(timeout);
          container.removeEventListener('mousemove', resetTimeout);
          container.removeEventListener('touchstart', resetTimeout);
        };
      }
    }

    return () => clearTimeout(timeout);
  }, [isOpen, currentMessage]);

  // Return early if not open or no messages
  if (!isOpen || !currentGroup || currentGroup.length === 0 || !currentMessage) return null;

  // Content for both Dialog and Sheet
  const MediaViewerContent = () => {
    return (
      <div
        ref={containerRef}
        className={cn(
          "touch-action-none h-full flex flex-col",
          isFullscreen && "bg-black"
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Media viewer area - takes full height with black background */}
        <div className="flex-1 flex flex-col bg-black">
          {/* Top control bar */}
          <div className={cn(
            "py-3 px-4 flex items-center justify-between transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/90 hover:bg-white/10 rounded-full h-10 w-10"
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="text-white/90 hover:bg-white/10 rounded-full h-10 w-10"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="text-white/90 hover:bg-white/10 rounded-full h-10 w-10"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white/90 hover:bg-white/10 rounded-full h-10 w-10"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(currentMessage.public_url, '_blank')}
                className="text-white/90 hover:bg-white/10 rounded-full h-10 w-10"
                aria-label="Download"
              >
                <Download className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Media content centered in the black area */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <MediaPlayer
                message={currentMessage}
                autoPlay={true}
                muted={false}
                loop={true}
                controls={true}
                className="max-h-[70vh] max-w-full object-contain"
                showLoadingIndicator={false}
              />
            </div>

            {/* Side navigation buttons - absolutely positioned */}
            <div className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 transition-opacity duration-300",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
              {hasPrevious && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrevious}
                  className="bg-black/30 hover:bg-black/50 text-white rounded-full h-12 w-12 border border-white/10"
                  aria-label="Previous item"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
            </div>

            <div className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-300",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
              {hasNext && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNext}
                  className="bg-black/30 hover:bg-black/50 text-white rounded-full h-12 w-12 border border-white/10"
                  aria-label="Next item"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
            </div>

            {/* Pagination indicator */}
            {currentGroup.length > 1 && (
              <div className={cn(
                "absolute bottom-4 left-1/2 -translate-x-1/2 transition-opacity duration-300",
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              )}>
                <div className="bg-black/50 rounded-full py-1 px-3 text-white/90 text-sm">
                  {currentIndex + 1} / {currentGroup.length}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Media detail component - collapsible on mobile */}
        <div className="flex-none overflow-y-auto bg-background">
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            {currentMessage && (
              <PublicEnhancedMediaDetail
                message={currentMessage}
                onShowOriginal={onShowOriginal}
                onShare={onShare}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render either Dialog (desktop) or Sheet (mobile) based on screen size
  return isMobile ? (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] p-0 m-0 max-w-full rounded-t-xl border-t border-white/10">
        <MediaViewerContent />
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(
        "max-w-7xl w-[95vw] h-[90vh] p-0 overflow-hidden border-0 rounded-xl bg-transparent shadow-2xl",
        className
      )}>
        <MediaViewerContent />
      </DialogContent>
    </Dialog>
  );
}
