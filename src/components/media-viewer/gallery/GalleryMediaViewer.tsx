
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { EnhancedMediaDisplay } from '../shared/EnhancedMediaDisplay';
import { Message } from '@/types/entities/Message';
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MediaViewerProps } from '@/components/ui/media-viewer';
import { sortMediaGroupItems, getTelegramMessageUrl } from '@/utils/mediaUtils';

export function GalleryMediaViewer({
  isOpen,
  onClose,
  currentGroup,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  className,
}: MediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sortedGroup, setSortedGroup] = useState<Message[]>([]);
  
  // Sort media group with images first, then videos
  useEffect(() => {
    if (currentGroup?.length) {
      setSortedGroup(sortMediaGroupItems([...currentGroup]));
    } else {
      setSortedGroup([]);
    }
  }, [currentGroup]);

  useEffect(() => {
    // Reset index when group changes
    setCurrentIndex(0);
  }, [sortedGroup]);

  const handlePrevItem = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prevIndex => prevIndex - 1);
    }
  }, [currentIndex]);

  const handleNextItem = useCallback(() => {
    if (currentIndex < sortedGroup.length - 1) {
      setCurrentIndex(prevIndex => prevIndex + 1);
    }
  }, [currentIndex, sortedGroup.length]);

  const currentItem = sortedGroup[currentIndex];
  const telegramUrl = currentItem ? getTelegramMessageUrl(currentItem) : null;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) {
          handlePrevItem();
        } else if (hasPrevious && onPrevious) {
          onPrevious();
        }
      } else if (e.key === 'ArrowRight') {
        if (currentIndex < sortedGroup.length - 1) {
          handleNextItem();
        } else if (hasNext && onNext) {
          onNext();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, sortedGroup.length, hasPrevious, hasNext, handlePrevItem, handleNextItem, onPrevious, onNext, onClose]);

  // Handle swipe navigation
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      if (currentIndex < sortedGroup.length - 1) {
        handleNextItem();
      } else if (hasNext && onNext) {
        onNext();
      }
    } else if (isRightSwipe) {
      if (currentIndex > 0) {
        handlePrevItem();
      } else if (hasPrevious && onPrevious) {
        onPrevious();
      }
    }
    
    setTouchStart(0);
    setTouchEnd(0);
  };

  if (!isOpen || !sortedGroup.length) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn("sm:max-w-5xl p-0 gap-0 bg-background/80 backdrop-blur-lg", className)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <DialogTitle>
          <VisuallyHidden>Gallery Media Viewer</VisuallyHidden>
        </DialogTitle>
        <div className="relative h-[80vh] flex flex-col">
          {/* Controls */}
          <div className="absolute top-2 right-2 z-20 flex gap-2">
            {telegramUrl && (
              <a 
                href={telegramUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2 bg-background/80 rounded-full hover:bg-background"
                title="Open in Telegram"
                aria-label="Open in Telegram"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
            )}
            <button 
              onClick={onClose}
              className="p-2 bg-background/80 rounded-full hover:bg-background"
              title="Close viewer"
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Previous/Next Group Controls */}
          {hasPrevious && onPrevious && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50"
              onClick={onPrevious}
              title="Previous group"
              aria-label="Previous group"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}
          
          {hasNext && onNext && (
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50"
              onClick={onNext}
              title="Next group"
              aria-label="Next group"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Previous/Next Item Controls */}
          {currentIndex > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute left-16 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50"
              onClick={handlePrevItem}
              title="Previous item"
              aria-label="Previous item"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          
          {currentIndex < sortedGroup.length - 1 && (
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute right-16 top-1/2 transform -translate-y-1/2 z-20 rounded-full bg-background/50"
              onClick={handleNextItem}
              title="Next item"
              aria-label="Next item"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          {/* Enhanced Media Display */}
          <div className="flex-1 flex items-center justify-center p-4 bg-black/50">
            {currentItem && (
              <EnhancedMediaDisplay 
                message={currentItem}
                className="rounded-md"
              />
            )}
          </div>

          {/* Thumbnails/Pagination */}
          {sortedGroup.length > 1 && (
            <div className="p-2 flex justify-center gap-2 bg-background/20">
              {sortedGroup.map((item, idx) => (
                <button
                  key={item.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    idx === currentIndex ? "bg-primary w-4" : "bg-muted-foreground/50"
                  )}
                  onClick={() => setCurrentIndex(idx)}
                  title={`Go to item ${idx + 1}`}
                  aria-label={`Go to item ${idx + 1}`}
                  aria-current={idx === currentIndex ? "true" : "false"}
                />
              ))}
            </div>
          )}

          {/* Caption */}
          {currentItem?.caption && (
            <div className="p-4 bg-background/10 max-h-32 overflow-y-auto">
              <p className="text-sm">{currentItem.caption}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
