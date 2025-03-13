
'use client'

import * as React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaItem } from '@/types'
import { cn } from '@/lib/utils'
import { format } from "date-fns";

interface ImageSwiperProps extends React.HTMLAttributes<HTMLDivElement> {
  media: MediaItem[];
  showNavigation?: boolean;
  className?: string;
  onIndexChange?: (index: number) => void;
  onClick?: () => void;
}

export function ImageSwiper({ 
  media, 
  className, 
  showNavigation, 
  onIndexChange,
  onClick,
  ...props 
}: ImageSwiperProps) {
  const [mediaIndex, setMediaIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const [lastNonVideoIndex, setLastNonVideoIndex] = React.useState(0);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Sort media to prioritize images over videos
  const sortedMedia = React.useMemo(() => {
    if (!media || !Array.isArray(media) || media.length === 0) {
      return [];
    }
    
    return [...media].sort((a, b) => {
      // First, check if mimeType exists
      const aIsImage = a.mimeType?.startsWith('image') || a.mime_type?.startsWith('image') || false;
      const bIsImage = b.mimeType?.startsWith('image') || b.mime_type?.startsWith('image') || false;
      
      // If mime_type is missing, try to infer from URL
      const aUrl = a.url || a.public_url || '';
      const bUrl = b.url || b.public_url || '';
      const aHasImageExt = aUrl.match(/\.(jpg|jpeg|png|gif)$/i);
      const bHasImageExt = bUrl.match(/\.(jpg|jpeg|png|gif)$/i);
      
      const aIsLikelyImage = aIsImage || !!aHasImageExt;
      const bIsLikelyImage = bIsImage || !!bHasImageExt;
      
      // Prioritize images
      return bIsLikelyImage ? 1 : aIsLikelyImage ? -1 : 0;
    });
  }, [media]);

  const currentMedia = sortedMedia[mediaIndex];
  const isVideo = (currentMedia?.mimeType || currentMedia?.mime_type)?.startsWith("video/") || 
                 ((currentMedia?.url || currentMedia?.public_url) && /\.(mp4|mov|webm|avi)$/i.test(currentMedia?.url || currentMedia?.public_url || ''));

  React.useEffect(() => {
    if (onIndexChange) {
      onIndexChange(mediaIndex);
    }
  }, [mediaIndex, onIndexChange]);

  React.useEffect(() => {
    if (!isVideo) {
      setLastNonVideoIndex(mediaIndex);
    }
  }, [mediaIndex, isVideo]);

  React.useEffect(() => {
    if (isHovered && !showNavigation) {
      const videoIndex = sortedMedia.findIndex(m => 
        (m.mimeType || m.mime_type)?.startsWith('video/') || 
        ((m.url || m.public_url) && /\.(mp4|mov|webm|avi)$/i.test(m.url || m.public_url || ''))
      );
      if (videoIndex !== -1) {
        setMediaIndex(videoIndex);
      }
    } else if (!isHovered && !showNavigation) {
      setMediaIndex(lastNonVideoIndex);
    }
  }, [isHovered, sortedMedia, lastNonVideoIndex, showNavigation]);

  React.useEffect(() => {
    if (isVideo && videoRef.current) {
      if (isHovered) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(error => {
          console.error("Video playback error:", error);
          setMediaError("Failed to play video");
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isHovered, isVideo]);

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMediaError(null);
    setMediaIndex((prev) => (prev + 1) % sortedMedia.length);
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMediaError(null);
    setMediaIndex((prev) => (prev - 1 + sortedMedia.length) % sortedMedia.length);
  };

  // Media error handler
  const handleMediaError = (type: 'image' | 'video') => {
    setMediaError(`Failed to load ${type}`);
  };

  if (!sortedMedia?.length) {
    return (
      <div className="group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400">No media available</span>
      </div>
    )
  }

  const productName = currentMedia.title || 
                      currentMedia.analyzed_content?.product_name || 
                      'Untitled Product';
  
  let formattedDate = '';
  
  try {
    const dateStr = currentMedia.uploadedAt || currentMedia.created_at || '';
    formattedDate = dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : 'Unknown date';
  } catch (e) {
    formattedDate = 'Unknown date';
  }

  return (
    <div
      className={cn("group relative aspect-video h-full w-full overflow-hidden rounded-lg bg-black/90", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent p-4 z-10">
        <h3 className="text-xl font-semibold text-white truncate">
          {productName}
        </h3>
        <p className="text-sm text-gray-300">
          {formattedDate}
        </p>
      </div>
      
      <div className="absolute bottom-2 w-full flex justify-center z-10">
        <div className="flex min-w-9 items-center justify-center rounded-md bg-black/80 px-2 py-0.5 text-xs text-white opacity-100 transition-opacity">
          {mediaIndex + 1}/{sortedMedia.length}
        </div>
      </div>

      {showNavigation && (
        <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10">
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
        <div className="absolute right-5 top-1/2 -translate-y-1/2 z-10">
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

      {mediaError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="bg-black/80 text-white px-4 py-3 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{mediaError}</span>
          </div>
        </div>
      )}

      {isVideo ? (
        <video
          ref={videoRef}
          src={currentMedia.url || currentMedia.public_url}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          autoPlay={isHovered}
          onError={() => handleMediaError('video')}
        />
      ) : (
        <img 
          src={currentMedia.url || currentMedia.public_url} 
          alt={productName}
          className="h-full w-full object-cover" 
          onError={() => handleMediaError('image')}
        />
      )}
    </div>
  )
}
