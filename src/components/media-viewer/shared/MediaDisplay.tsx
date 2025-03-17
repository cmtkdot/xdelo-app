
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { VideoPlayer } from './VideoPlayer';
import { ImageViewer } from './ImageViewer';
import { MediaDisplayProps } from '../types';
import { isVideoMessage } from '@/utils/mediaUtils';
import { FileX } from 'lucide-react';

export function MediaDisplay({ message, className }: MediaDisplayProps) {
  const [mediaError, setMediaError] = useState(false);
  
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
    console.error(`Media load error for message: ${message.id}`);
    setMediaError(true);
  };
  
  const handleMediaLoad = () => {
    setMediaError(false);
  };

  // If media failed to load, show error state
  if (mediaError) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full rounded-md bg-muted/20">
        <FileX className="h-12 w-12 text-muted-foreground mb-4" />
        <span className="text-muted-foreground text-center">
          Media failed to load
        </span>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full h-full flex items-center justify-center overflow-hidden bg-muted/20 rounded-md", 
      className
    )}>
      {isVideo ? (
        <VideoPlayer 
          src={message.public_url} 
          message={message} 
          className="w-full max-h-full"
          onError={handleMediaError}
          onLoad={handleMediaLoad}
        />
      ) : (
        <ImageViewer
          src={message.public_url}
          alt={message.caption || "Media"}
          message={message}
          className="w-full h-full"
          onError={handleMediaError}
          onLoad={handleMediaLoad}
        />
      )}
    </div>
  );
}
