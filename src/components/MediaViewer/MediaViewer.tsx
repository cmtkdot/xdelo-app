
import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types';
import { MediaDisplay } from './MediaDisplay';
import { MediaToolbar } from './MediaToolbar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  initialIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  className?: string;
}

export function MediaViewer({
  isOpen,
  onClose,
  currentGroup,
  initialIndex = 0,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  className
}: MediaViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const currentMedia = currentGroup[currentIndex];
  
  // Reset current index when group changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [currentGroup, initialIndex]);
  
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else if (onPrevious) {
      onPrevious();
    }
  }, [currentIndex, onPrevious]);
  
  const handleNext = useCallback(() => {
    if (currentIndex < currentGroup.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (onNext) {
      onNext();
    }
  }, [currentIndex, currentGroup.length, onNext]);
  
  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case 'Escape':
          onClose();
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrevious, onClose]);
  
  // Handle touch gestures for navigation
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
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
      handleNext();
    } else if (isRightSwipe) {
      handlePrevious();
    }
  };
  
  const canNavigatePrevious = currentIndex > 0 || !!onPrevious && hasPrevious;
  const canNavigateNext = currentIndex < currentGroup.length - 1 || !!onNext && hasNext;
  
  if (!currentMedia) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn("max-w-7xl w-full h-[90vh] p-0 overflow-hidden flex flex-col", className)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Close button */}
        <div className="absolute top-2 right-2 z-50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full text-white/70 hover:text-white hover:bg-white/10"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Navigation overlays */}
        {canNavigatePrevious && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-24 flex items-center justify-start p-2 z-10 cursor-pointer"
            onClick={handlePrevious}
          >
            <div className="bg-black/30 rounded-full p-2 hover:bg-black/50 transition-colors">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </div>
        )}
        
        {canNavigateNext && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-24 flex items-center justify-end p-2 z-10 cursor-pointer"
            onClick={handleNext}
          >
            <div className="bg-black/30 rounded-full p-2 hover:bg-black/50 transition-colors">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        )}
        
        {/* Media display */}
        <div className="flex-1 overflow-hidden relative">
          <MediaDisplay message={currentMedia} />
        </div>
        
        {/* Toolbar */}
        <MediaToolbar 
          currentMedia={currentMedia}
        />
      </DialogContent>
    </Dialog>
  );
}
