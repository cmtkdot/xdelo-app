
'use client'

import * as React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaItem } from '@/types'
import { cn } from '@/lib/utils'
import { format } from "date-fns";

interface ImageSwiperProps extends React.HTMLAttributes<HTMLDivElement> {
  media: MediaItem[];
  showNavigation?: boolean;
  className?: string;
}

export function ImageSwiper({ media, className, showNavigation, ...props }: ImageSwiperProps) {
  const [mediaIndex, setMediaIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [lastNonVideoIndex, setLastNonVideoIndex] = React.useState(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Find first video in the media array
  const firstVideoIndex = React.useMemo(() => {
    return media.findIndex(m => m.mime_type?.startsWith('video/'));
  }, [media]);

  const sortedMedia = React.useMemo(() => {
    return [...media].sort((a, b) => {
      const aIsImage = a.mime_type?.startsWith('image') || false;
      const bIsImage = b.mime_type?.startsWith('image') || false;
      return bIsImage ? 1 : aIsImage ? -1 : 0;
    });
  }, [media]);

  const currentMedia = sortedMedia[mediaIndex];
  const isVideo = currentMedia?.mime_type?.startsWith("video/");

  // Store the last non-video index when changing media
  React.useEffect(() => {
    if (!isVideo) {
      setLastNonVideoIndex(mediaIndex);
    }
  }, [mediaIndex, isVideo]);

  // Handle hover state changes
  React.useEffect(() => {
    if (isHovered && !showNavigation) { // Only auto-switch to video when not in navigation mode
      // Find first video in the group
      const videoIndex = sortedMedia.findIndex(m => m.mime_type?.startsWith('video/'));
      if (videoIndex !== -1) {
        setMediaIndex(videoIndex);
      }
    } else if (!isHovered && !showNavigation) { // Only switch back when not in navigation mode
      // Return to last non-video index when leaving hover
      setMediaIndex(lastNonVideoIndex);
    }
  }, [isHovered, sortedMedia, lastNonVideoIndex, showNavigation]);

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

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMediaIndex((prev) => (prev + 1) % sortedMedia.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMediaIndex((prev) => (prev - 1 + sortedMedia.length) % sortedMedia.length);
  };

  if (!sortedMedia?.length) {
    return (
      <div className="group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400">No media available</span>
      </div>
    )
  }

  return (
    <div
      className={cn("group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-black/90", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {/* Product info overlay */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent p-4">
        <h3 className="text-xl font-semibold text-white">
          {sortedMedia[mediaIndex].analyzed_content?.product_name || 'Untitled Product'}
        </h3>
        <p className="text-sm text-gray-300">
          {format(new Date(sortedMedia[mediaIndex].created_at), 'MMM d, yyyy')}
        </p>
      </div>
      <div className="absolute bottom-2 w-full flex justify-center">
        <div className="flex min-w-9 items-center justify-center rounded-md bg-black/80 px-2 py-0.5 text-xs text-white opacity-100 transition-opacity">
          {mediaIndex + 1}/{sortedMedia.length}
        </div>
      </div>

      {showNavigation && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2">
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto h-8 w-8 rounded-full bg-black/50 hover:bg-black/75 text-white opacity-100 transition-opacity"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
      {showNavigation && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2">
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto h-8 w-8 rounded-full bg-black/50 hover:bg-black/75 text-white opacity-100 transition-opacity"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {isVideo ? (
        <video
          ref={videoRef}
          src={currentMedia.public_url}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          autoPlay={true}
        />
      ) : (
        <img 
          src={currentMedia.public_url} 
          alt={sortedMedia[mediaIndex].analyzed_content?.product_name || 'Product image'}
          className="h-full w-full object-cover" 
        />
      )}
    </div>
  )
}
