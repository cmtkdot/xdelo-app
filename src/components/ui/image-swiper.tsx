
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { MediaItem } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface ImageSwiperProps {
  media: MediaItem[];
  className?: string;
}

export const ImageSwiper = ({ media, className }: ImageSwiperProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!media || media.length === 0) {
    return null;
  }

  const currentMedia = media[currentIndex];
  const isVideo = currentMedia.mime_type?.startsWith('video/');

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < media.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  console.log('Current media:', currentMedia); // Debug log
  console.log('Is video:', isVideo); // Debug log

  return (
    <div className={cn("relative w-full h-full", className)}>
      {isVideo ? (
        <video
          key={currentMedia.public_url} // Add key to force video reload
          src={currentMedia.public_url || undefined}
          controls
          className="absolute inset-0 w-full h-full object-contain bg-black"
          playsInline // Add playsinline for mobile
        />
      ) : (
        <img
          key={currentMedia.public_url} // Add key to force image reload
          src={currentMedia.public_url || "/placeholder.svg"}
          alt={currentMedia.caption || "Media content"}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      
      {media.length > 1 && (
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="rounded-full bg-background/80 hover:bg-background/90 backdrop-blur"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === media.length - 1}
            className="rounded-full bg-background/80 hover:bg-background/90 backdrop-blur"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {media.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {media.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={cn(
                "w-2 h-2 rounded-full",
                currentIndex === index
                  ? "bg-white"
                  : "bg-white/50 hover:bg-white/75"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};
