
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi
} from "@/components/ui/carousel";
import { useIsMobile } from '@/hooks/useMobile';

export interface MediaCarouselItem {
  id: string;
  public_url: string;
  mime_type?: string;
  caption?: string;
  type?: 'image' | 'video' | 'document' | 'audio' | 'unknown';
}

interface MediaCarouselProps {
  items: MediaCarouselItem[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  renderItem: (item: MediaCarouselItem) => React.ReactNode;
  className?: string;
}

export function MediaCarousel({
  items,
  activeIndex,
  onIndexChange,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  renderItem,
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
        if (activeIndex < items.length - 1) {
          onIndexChange(activeIndex + 1);
        } else if (hasNext && onNext) {
          onNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, items.length, onIndexChange, hasPrevious, hasNext, onPrevious, onNext]);

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

  // Handle external navigation (between media groups)
  const handleExternalPrevious = () => {
    if (onPrevious && activeIndex === 0 && hasPrevious) {
      onPrevious();
    }
  };

  const handleExternalNext = () => {
    if (onNext && activeIndex === items.length - 1 && hasNext) {
      onNext();
    }
  };

  return (
    <div className={cn("relative h-full w-full flex items-center justify-center bg-background/5", className)}>
      {items.length === 1 ? (
        // Single item display without carousel
        <div className="h-full w-full flex items-center justify-center">
          {renderItem(items[0])}
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
            {items.map((item, index) => (
              <CarouselItem key={item.id || index} className="h-full flex items-center justify-center">
                <div className="w-full h-full flex items-center justify-center p-2">
                  {renderItem(item)}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          
          <CarouselPrevious 
            onClick={handleExternalPrevious}
            className="left-2 bg-background/40 hover:bg-background/60 border-none"
          />
          
          <CarouselNext 
            onClick={handleExternalNext}
            className="right-2 bg-background/40 hover:bg-background/60 border-none"
          />
          
          {/* Image counter indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/60 px-2 py-1 rounded-md text-xs">
            {activeIndex + 1} / {items.length}
          </div>
        </Carousel>
      )}
      
      {/* External navigation for group navigation */}
      {activeIndex === 0 && hasPrevious && onPrevious && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/40 hover:bg-background/60 z-20"
          onClick={onPrevious}
          aria-label="Previous group"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}
      
      {activeIndex === items.length - 1 && hasNext && onNext && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/40 hover:bg-background/60 z-20"
          onClick={onNext}
          aria-label="Next group"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
