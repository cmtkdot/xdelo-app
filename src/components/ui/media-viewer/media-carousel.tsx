
'use client'

import React, { useState, useEffect } from 'react';
import { Message } from '@/types/MessagesTypes';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import { MediaDisplay } from './media-display';
import { useTouchInteraction } from '@/hooks/useTouchInteraction';
import { useIsMobile } from '@/hooks/useMobile';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi
} from "@/components/ui/carousel";

interface MediaCarouselProps {
  mediaItems: Message[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

export function MediaCarousel({
  mediaItems,
  activeIndex,
  onIndexChange,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  className
}: MediaCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const isMobile = useIsMobile();
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        if (activeIndex > 0) {
          onIndexChange(activeIndex - 1);
        } else if (hasPrevious && onPrevious) {
          onPrevious();
        }
      } else if (e.key === 'ArrowRight') {
        if (activeIndex < mediaItems.length - 1) {
          onIndexChange(activeIndex + 1);
        } else if (hasNext && onNext) {
          onNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Return a cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, mediaItems.length, onIndexChange, hasPrevious, hasNext, onPrevious, onNext]);

  // Sync carousel with active index
  useEffect(() => {
    if (!api) return;
    api.scrollTo(activeIndex);
  }, [api, activeIndex]);

  // Handle carousel change
  useEffect(() => {
    if (!api) return;
    
    const onChange = () => {
      const currentIndex = api.selectedScrollSnap();
      onIndexChange(currentIndex);
    };
    
    api.on("select", onChange);
    return () => {
      api.off("select", onChange);
    };
  }, [api, onIndexChange]);

  // Handle swipe gestures for mobile
  const { bindTouchHandlers } = useTouchInteraction({
    onSwipeLeft: () => {
      if (activeIndex < mediaItems.length - 1) {
        onIndexChange(activeIndex + 1);
      } else if (hasNext && onNext) {
        onNext();
      }
    },
    onSwipeRight: () => {
      if (activeIndex > 0) {
        onIndexChange(activeIndex - 1);
      } else if (hasPrevious && onPrevious) {
        onPrevious();
      }
    },
    swipeThreshold: 30,
    preventScrollingWhenSwiping: true
  });

  // Handle external navigation (between media groups)
  const handleExternalPrevious = () => {
    if (onPrevious && activeIndex === 0 && hasPrevious) {
      onPrevious();
    }
  };

  const handleExternalNext = () => {
    if (onNext && activeIndex === mediaItems.length - 1 && hasNext) {
      onNext();
    }
  };

  return (
    <div 
      className={cn("relative h-full flex items-center justify-center", className)} 
      {...bindTouchHandlers}
    >
      {mediaItems.length === 1 ? (
        // Single item display without carousel
        <div className="h-full w-full flex items-center justify-center">
          <MediaDisplay message={mediaItems[0]} className="max-h-full" />
        </div>
      ) : (
        // Multiple items carousel
        <Carousel
          className="h-full w-full"
          setApi={setApi}
          opts={{
            startIndex: activeIndex,
            align: "center",
            loop: false,
          }}
        >
          <CarouselContent className="h-full">
            {mediaItems.map((message, index) => (
              <CarouselItem key={message.id || index} className="h-full flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center">
                  <MediaDisplay message={message} />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          
          <CarouselPrevious 
            onClick={handleExternalPrevious}
            className="left-2 bg-black/40 text-white hover:bg-black/60 border-none"
          />
          
          <CarouselNext 
            onClick={handleExternalNext}
            className="right-2 bg-black/40 text-white hover:bg-black/60 border-none"
          />
          
          {/* Image counter indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
            {activeIndex + 1} / {mediaItems.length}
          </div>
        </Carousel>
      )}
      
      {/* External navigation for group navigation */}
      {activeIndex === 0 && hasPrevious && onPrevious && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 z-20"
          onClick={onPrevious}
          aria-label="Previous group"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}
      
      {activeIndex === mediaItems.length - 1 && hasNext && onNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 z-20"
          onClick={onNext}
          aria-label="Next group"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
