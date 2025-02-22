
import React from "react";
import { cn } from "@/lib/utils";
import { MediaItem } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { format } from "date-fns";

interface ImageSwiperProps {
  media: MediaItem[];
  className?: string;
}

export const ImageSwiper = ({ media, className }: ImageSwiperProps) => {
  const [mediaIndex, setMediaIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [lastNonVideoIndex, setLastNonVideoIndex] = React.useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Sort media to prioritize images
  const sortedMedia = React.useMemo(() => {
    return [...media].sort((a, b) => {
      const aIsImage = !a.mime_type?.startsWith('video/');
      const bIsImage = !b.mime_type?.startsWith('video/');
      if (aIsImage && !bIsImage) return -1;
      if (!aIsImage && bIsImage) return 1;
      return 0;
    });
  }, [media]);

  const currentMedia = sortedMedia[mediaIndex];
  const isVideo = currentMedia?.mime_type?.startsWith('video/');

  // Store the last non-video index when changing media
  React.useEffect(() => {
    if (!isVideo) {
      setLastNonVideoIndex(mediaIndex);
    }
  }, [mediaIndex, isVideo]);

  // Handle hover state changes
  React.useEffect(() => {
    if (isHovered) {
      // Find first video in the group
      const videoIndex = sortedMedia.findIndex(m => m.mime_type?.startsWith('video/'));
      if (videoIndex !== -1) {
        setMediaIndex(videoIndex);
      }
    } else {
      // Return to last non-video index when leaving hover
      setMediaIndex(lastNonVideoIndex);
    }
  }, [isHovered, sortedMedia, lastNonVideoIndex]);

  // Handle video playback
  React.useEffect(() => {
    if (isVideo && videoRef.current) {
      if (isHovered) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isHovered, isVideo]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev + 1) % sortedMedia.length);
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaIndex((prev) => (prev - 1 + sortedMedia.length) % sortedMedia.length);
  };

  if (!sortedMedia?.length) {
    return (
      <div className="group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400">No media available</span>
      </div>
    );
  }

  return (
    <div 
      className={cn("group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-black/90", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product info overlay */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent p-4 z-10">
        <h3 className="text-xl font-semibold text-white">
          {currentMedia.analyzed_content?.product_name || 'Untitled Product'}
        </h3>
        <p className="text-sm text-gray-300">
          {format(new Date(currentMedia.created_at), 'MMM d, yyyy')}
        </p>
      </div>

      {/* Media counter */}
      <div className="absolute bottom-2 w-full flex justify-center z-10">
        <div className="flex min-w-9 items-center justify-center rounded-md bg-black/80 px-2 py-0.5 text-xs text-white">
          {mediaIndex + 1}/{sortedMedia.length}
        </div>
      </div>

      {/* Navigation buttons */}
      {sortedMedia.length > 1 && (
        <>
          <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-black/50 hover:bg-black/75 text-white"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-black/50 hover:bg-black/75 text-white"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* Media display */}
      {isVideo ? (
        <video
          ref={videoRef}
          src={currentMedia.public_url || undefined}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          autoPlay={isHovered}
        />
      ) : (
        <img 
          src={currentMedia.public_url || "/placeholder.svg"}
          alt={currentMedia.analyzed_content?.product_name || 'Product image'}
          className="h-full w-full object-cover"
        />
      )}

      {/* Dot indicators */}
      {sortedMedia.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
          {sortedMedia.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setMediaIndex(index);
              }}
              className={cn(
                "w-2 h-2 rounded-full",
                mediaIndex === index
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
