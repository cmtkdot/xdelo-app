
import React from 'react';
import { MediaItem } from '@/types';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface MediaDisplayProps {
  media: MediaItem;
  className?: string;
  showControls?: boolean;
  onError?: (type: 'image' | 'video') => void;
}

export function MediaDisplay({
  media,
  className,
  showControls = false,
  onError,
}: MediaDisplayProps) {
  const [mediaError, setMediaError] = React.useState<string | null>(null);

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
    if (onError) onError(type);
  };

  return (
    <div className={cn("relative w-full h-full flex items-center justify-center bg-black", className)}>
      {mediaError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="bg-black/80 text-white px-4 py-3 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{mediaError}</span>
          </div>
        </div>
      ) : isVideo ? (
        <video
          src={media.public_url}
          className="max-w-full max-h-full object-contain"
          controls={showControls}
          playsInline
          onError={() => handleMediaError('video')}
        />
      ) : (
        <img 
          src={media.public_url} 
          alt={media.caption || "Media"}
          className="max-w-full max-h-full object-contain" 
          onError={() => handleMediaError('image')}
        />
      )}
    </div>
  );
}
