import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MediaDisplayProps } from '../types';



/**
 * EnhancedMediaDisplay - A completely rewritten media display component
 * with better support for images and videos across devices
 */
export function EnhancedMediaDisplay({ 
  message, 
  className,
  onLoadSuccess,
  onLoadError
}: MediaDisplayProps) {
  const [loadState, setLoadState] = useState<'loading' | 'success' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  
  // Use URL with cache buster for retries
  const mediaUrl = useMemo(() => {
    if (!message?.public_url) return '';
    
    // Only add cache buster if we've retried
    if (retryCount > 0) {
      const cacheBuster = `_cb=${Date.now()}`;
      return message.public_url.includes('?') 
        ? `${message.public_url}&${cacheBuster}` 
        : `${message.public_url}?${cacheBuster}`;
    }
    
    return message.public_url;
  }, [message?.public_url, retryCount]);
  
  // Reset state when message changes
  useEffect(() => {
    setLoadState('loading');
    setRetryCount(0);
  }, [message?.id]);
  
  // Detect media type
  const mediaType = useMemo(() => {
    if (!message) return 'unknown';
    
    // Check MIME type first
    if (message.mime_type?.startsWith('video/')) return 'video';
    if (message.mime_type?.startsWith('image/')) return 'image';
    
    // Check URL extension
    const url = message.public_url || '';
    const videoExts = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    
    if (videoExts.some(ext => url.toLowerCase().endsWith(ext))) return 'video';
    if (imageExts.some(ext => url.toLowerCase().endsWith(ext))) return 'image';
    
    // Check Telegram data as fallback
    if (message.telegram_data?.video) return 'video';
    if (message.telegram_data?.photo) return 'image';
    
    return 'unknown';
  }, [message]);
  
  // Handle retry
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setLoadState('loading');
  };
  
  // Handle load events
  const handleLoadSuccess = () => {
    setLoadState('success');
    onLoadSuccess?.();
  };
  
  const handleLoadError = () => {
    setLoadState('error');
    onLoadError?.();
  };
  
  // If no message or URL, show empty state
  if (!message || !message.public_url) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-muted/10 rounded-md">
        <div className="text-muted-foreground text-sm">No media available</div>
      </div>
    );
  }
  
  // Show error state
  if (loadState === 'error') {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center w-full h-full bg-muted/10 rounded-md p-4", 
        className
      )}>
        <AlertCircle className="h-10 w-10 text-muted-foreground/70 mb-2" />
        <h3 className="text-sm font-medium text-center mb-1">
          Media Failed to Load
        </h3>
        <p className="text-xs text-muted-foreground/70 text-center mb-4 max-w-[250px]">
          The media may be temporarily unavailable or have been removed
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="flex items-center gap-1.5 h-8"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Try Again</span>
        </Button>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "relative flex items-center justify-center w-full h-full bg-black/80 rounded-md overflow-hidden",
      "aspect-video", // Fixed 16:9 aspect ratio container for consistency
      className
    )}>
      {/* Loading overlay */}
      {loadState === 'loading' && (
        <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-l-transparent animate-spin" />
            <div className="text-xs text-muted-foreground animate-pulse">
              Loading {mediaType === 'video' ? 'video' : 'image'}...
            </div>
          </div>
        </div>
      )}
      
      {/* Render the appropriate media */}
      {mediaType === 'video' ? (
        <VideoDisplay 
          url={mediaUrl} 
          key={`video-${message.id}-${retryCount}`}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          mimeType={message.mime_type}
        />
      ) : (
        <ImageDisplay 
          url={mediaUrl}
          alt={message.caption || 'Image'}
          key={`image-${message.id}-${retryCount}`}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
        />
      )}
    </div>
  );
}

// Separated image display component
function ImageDisplay({ 
  url, 
  alt, 
  onLoadSuccess, 
  onLoadError 
}: { 
  url: string; 
  alt: string; 
  onLoadSuccess: () => void; 
  onLoadError: () => void; 
}) {
  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-cover" // Consistent filling of container
      onLoad={onLoadSuccess}
      onError={onLoadError}
      loading="lazy"
      decoding="async"
    />
  );
}

// Separated video display component with fallbacks and better support
function VideoDisplay({
  url,
  onLoadSuccess,
  onLoadError,
  mimeType
}: {
  url: string;
  onLoadSuccess: () => void;
  onLoadError: () => void;
  mimeType?: string;
}) {
  // Handle video play error internally to attempt auto-switching to picture in picture
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const videoEl = e.currentTarget;
    
    // Log actual error
    console.warn('Video playback error:', e);
    
    // Try triggering PiP mode if supported and available
    if (document.pictureInPictureEnabled && !document.pictureInPictureElement) {
      try {
        // Just a last-ditch effort to make the video play
        videoEl.play().catch(() => {
          // If even that fails, report the error up
          onLoadError();
        });
      } catch {
        onLoadError();
      }
    } else {
      onLoadError();
    }
  };
  
  return (
    <div className="w-full h-full flex items-center justify-center">
      <video
        src={url}
        className="w-full h-full object-cover" // Consistent filling of container
        controls
        controlsList="nodownload"
        preload="metadata"
        onLoadedData={onLoadSuccess}
        onError={handleVideoError}
        playsInline
        autoPlay={false}
        muted={false}
        loop={false}
      >
        <source src={url} type={mimeType || 'video/mp4'} />
        <p className="p-4 text-muted-foreground text-sm text-center">
          Your browser doesn't support this video format.
          <a 
            href={url} 
            target="_blank" 
            rel="noreferrer" 
            className="text-primary hover:underline ml-1"
          >
            Download instead
          </a>
        </p>
      </video>
    </div>
  );
}
