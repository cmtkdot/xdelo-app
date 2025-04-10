
import React, { useState, useEffect, useRef } from 'react';
import { Film, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Spinner } from '@/components/ui/spinner';
import { Message } from '@/types/entities/Message';
import { Button } from '@/components/ui/button';
import { getVideoMetadata, getVideoDimensions } from '@/utils/mediaUtils';

interface VideoPlayerProps {
  src: string;
  message: Message;
  className?: string;
  autoPlay?: boolean;
  onError?: () => void;
  onLoad?: () => void;
}

export function VideoPlayer({ 
  src, 
  message, 
  className, 
  autoPlay = false, 
  onError,
  onLoad
}: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Get proper dimensions from telegram_data if available
  const dimensions = getVideoDimensions(message);
  const aspectRatio = dimensions.width / dimensions.height;

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setError(null);
    onLoad?.();
    
    // Auto-play if specified
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(err => {
        console.warn('Auto-play prevented by browser:', err);
      });
    }
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setError('Failed to load video');
    console.error('Video load error:', message.id, src);
    onError?.();
  };

  const handleMouseEnter = () => {
    setShowControls(true);
    if (videoRef.current && !isLoading && !error && autoPlay) {
      videoRef.current.play().catch(err => {
        console.warn('Auto-play prevented by browser:', err);
      });
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    setShowControls(false);
    if (videoRef.current && autoPlay) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(err => {
          console.warn('Play prevented by browser:', err);
        });
        setIsPlaying(true);
      }
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    
    // Force reload the video by updating the src with a cache-busting parameter
    if (videoRef.current) {
      const newSrc = src.includes('?') ? 
        `${src}&cache=${Date.now()}` : 
        `${src}?cache=${Date.now()}`;
      
      videoRef.current.src = newSrc;
      videoRef.current.load();
    }
  };

  // Try to fix MIME type issues by using appropriate content-type
  const getVideoType = () => {
    // First check telegram_data for the most accurate mime type
    const videoMetadata = getVideoMetadata(message);
    if (videoMetadata?.mime_type) {
      return videoMetadata.mime_type;
    }
    
    // Then check message mime type
    if (message.mime_type && message.mime_type.startsWith('video/')) {
      return message.mime_type;
    }
    
    // Fallback to extension-based detection
    if (src.endsWith('.mp4')) return 'video/mp4';
    if (src.endsWith('.webm')) return 'video/webm';
    if (src.endsWith('.mov')) return 'video/quicktime';
    if (src.endsWith('.avi')) return 'video/x-msvideo';
    
    return 'video/mp4'; // Default to MP4
  };

  return (
    <div 
      className={cn("relative w-full cursor-pointer", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <Spinner size="lg" className="mb-2" />
          <p className="text-sm">Loading video...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="bg-background/90 px-6 py-4 rounded-lg shadow-lg flex flex-col items-center">
            <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
            <p className="text-center mb-3">{error}</p>
            <p className="text-xs text-center mb-3 text-muted-foreground">
              The video format may not be supported by your browser or the file may be corrupted.
            </p>
            <Button 
              variant="default" 
              onClick={handleRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {/* Play/Pause overlay on top of video */}
      {!isLoading && !error && !showControls && !isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 z-10"
          onClick={handleVideoClick}
        >
          <div className="rounded-full bg-black/50 p-3 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white fill-current">
              <path d="M8 5v14l11-7z"></path>
            </svg>
          </div>
        </div>
      )}
      
      {/* Video player */}
      <AspectRatio ratio={aspectRatio} className="w-full h-auto overflow-hidden rounded-md">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain rounded-md"
          controls={showControls || !autoPlay}
          playsInline
          onLoadedData={handleLoadSuccess}
          onError={handleLoadError}
          controlsList="nodownload"
          poster="/placeholder.svg"
          preload="metadata"
          onClick={handleVideoClick}
        >
          <source src={src} type={getVideoType()} />
          Your browser does not support the video tag.
        </video>
      </AspectRatio>
    </div>
  );
}
