
import React, { useState } from 'react';
import { MediaItem } from '@/types';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface MediaDisplayProps {
  media: MediaItem;
  className?: string;
  showControls?: boolean;
  onError?: (type: 'image' | 'video') => void;
  onRetry?: () => void;
}

export function MediaDisplay({
  media,
  className,
  showControls = false,
  onError,
  onRetry,
}: MediaDisplayProps) {
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Safety check for valid media
  if (!media || !media.public_url) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-muted">
        <span className="text-muted-foreground">Media not available</span>
      </div>
    );
  }

  // Determine if this is a video based on mime type or URL
  const isVideo = media.mime_type?.startsWith('video/') || 
                 (media.public_url && /\.(mp4|mov|webm|avi)$/i.test(media.public_url));

  // Handle media loading errors
  const handleMediaError = (type: 'image' | 'video') => {
    setMediaError(`Failed to load ${type}`);
    setIsLoading(false);
    if (onError) onError(type);
  };

  // Handle media load success
  const handleMediaLoaded = () => {
    setIsLoading(false);
  };

  // Handle retry attempt
  const handleRetry = () => {
    setMediaError(null);
    setIsLoading(true);
    if (onRetry) onRetry();
  };

  return (
    <div className={cn("relative w-full h-full flex items-center justify-center bg-black", className)}>
      {isLoading && !mediaError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
          <Spinner size="lg" className="mb-2" />
          <p className="text-white text-sm">Loading media...</p>
        </div>
      )}
      
      {mediaError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="bg-black/80 text-white px-6 py-4 rounded-lg flex flex-col items-center">
            <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
            <p className="text-center mb-3">{mediaError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        </div>
      ) : isVideo ? (
        <video
          src={media.public_url}
          className="max-w-full max-h-full object-contain"
          controls={showControls}
          playsInline
          onError={() => handleMediaError('video')}
          onLoadedData={handleMediaLoaded}
        />
      ) : (
        <img 
          src={media.public_url} 
          alt={media.caption || "Media"}
          className="max-w-full max-h-full object-contain" 
          onError={() => handleMediaError('image')}
          onLoad={handleMediaLoaded}
        />
      )}
    </div>
  );
}
