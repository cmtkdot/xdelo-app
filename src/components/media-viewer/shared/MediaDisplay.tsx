
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/generalUtils';
import { Message } from '@/types';
import { isVideoMessage } from '@/utils/mediaUtils';

interface MediaDisplayProps {
  message: Message;
  className?: string;
}

export function MediaDisplay({ message, className }: MediaDisplayProps) {
  const [mediaError, setMediaError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Reset error state when message changes
  useEffect(() => {
    setMediaError(false);
    setIsLoading(true);
  }, [message?.id]);
  
  if (!message || !message.public_url) {
    return (
      <div className="flex items-center justify-center w-full h-full rounded-md bg-muted/20">
        <span className="text-muted-foreground">Media not available</span>
      </div>
    );
  }

  // Use the enhanced telegram_data-aware isVideoMessage function
  const isVideo = isVideoMessage(message);
  
  const handleMediaError = () => {
    // Reduce to warning level to avoid flooding console with errors
    console.warn(`Media load error for message: ${message.id}`);
    setIsLoading(false);
    setMediaError(true);
  };
  
  const handleMediaLoad = () => {
    setIsLoading(false);
    setMediaError(false);
  };

  // If media failed to load, show error state
  if (mediaError) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full rounded-md bg-muted/20">
        <div className="h-12 w-12 text-muted-foreground mb-4 flex items-center justify-center">
          {isVideo ? '🎬' : '🖼️'}
        </div>
        <span className="text-muted-foreground text-center">
          {isVideo ? 'Video' : 'Image'} failed to load
        </span>
        <button 
          className="mt-4 text-xs text-primary underline" 
          onClick={() => {
            // Reset error state to allow retry
            setMediaError(false);
            setIsLoading(true);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full h-full flex items-center justify-center overflow-hidden bg-muted/20 rounded-md", 
      className
    )}>
      {/* Show loading indicator while media is loading */}
      {isLoading && !mediaError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 backdrop-blur-sm">
          <div className="animate-pulse text-muted-foreground text-sm">
            Loading {isVideo ? 'video' : 'image'}...
          </div>
        </div>
      )}
      
      {isVideo ? (
        <video 
          src={message.public_url} 
          className="max-h-full max-w-full object-contain" 
          controls
          // Prevent autoloading to reduce bandwidth and errors
          preload="metadata"
          onError={handleMediaError}
          onLoadedData={handleMediaLoad}
        />
      ) : (
        <img
          src={message.public_url}
          alt={message.caption || "Media"}
          className="max-h-full max-w-full object-contain"
          onError={handleMediaError}
          onLoad={handleMediaLoad}
          // Add loading="lazy" to improve performance
          loading="lazy"
        />
      )}
    </div>
  );
}
