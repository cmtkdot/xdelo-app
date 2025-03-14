
import React, { useState } from 'react';
import { MediaItem } from '@/types';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { cn } from "@/lib/generalUtils";

interface MediaDisplayProps {
  mediaItems: MediaItem[];
  onMediaChange: (index: number) => void;
  initialIndex?: number;
  className?: string;
}

export function MediaDisplay({
  mediaItems,
  onMediaChange,
  initialIndex = 0,
  className
}: MediaDisplayProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  
  // Safely handle index change
  const handleIndexChange = (index: number) => {
    setActiveIndex(index);
    onMediaChange(index);
  };

  // If there are no media items, show empty state
  if (!mediaItems || mediaItems.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/90">
        <span className="text-white/70">No media available</span>
      </div>
    );
  }

  return (
    <div className={cn("relative flex-1 min-h-0 bg-black/90 overflow-hidden", className)}>
      {mediaItems.length > 1 ? (
        <Carousel 
          className="w-full h-full"
          onSelect={handleIndexChange}
          defaultIndex={initialIndex}
        >
          <CarouselContent className="h-full">
            {mediaItems.map((item, index) => (
              <CarouselItem key={item.id} className="h-full">
                <div className="aspect-video w-full h-full flex items-center justify-center relative overflow-hidden">
                  {item.mime_type?.startsWith('video/') ? (
                    <video 
                      src={item.public_url} 
                      className="w-full h-full object-contain"
                      controls
                    />
                  ) : (
                    <img 
                      src={item.public_url} 
                      alt={item.caption || 'Media item'} 
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          
          <div className="absolute inset-0 flex justify-between items-center pointer-events-none">
            <CarouselPrevious className="relative h-8 w-8 ml-2 pointer-events-auto" />
            <CarouselNext className="relative h-8 w-8 mr-2 pointer-events-auto" />
          </div>
          
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
            {activeIndex + 1} / {mediaItems.length}
          </div>
        </Carousel>
      ) : (
        <div className="aspect-video w-full h-full flex items-center justify-center">
          {mediaItems[0]?.mime_type?.startsWith('video/') ? (
            <video 
              src={mediaItems[0]?.public_url} 
              className="w-full h-full object-contain"
              controls
            />
          ) : (
            <img 
              src={mediaItems[0]?.public_url} 
              alt={mediaItems[0]?.caption || 'Media item'} 
              className="w-full h-full object-contain"
            />
          )}
        </div>
      )}
    </div>
  );
}
