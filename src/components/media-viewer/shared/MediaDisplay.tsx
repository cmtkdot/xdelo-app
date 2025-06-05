
import React, { useState } from 'react';
import { cn } from '@/lib/generalUtils';
import { Message } from '@/types';
import { isVideoMessage } from '@/utils/mediaUtils';
import { FileX } from 'lucide-react';

interface MediaDisplayProps {
  message: Message;
  className?: string;
}

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
        <video 
          src={message.public_url} 
          className="max-h-full max-w-full object-contain" 
          controls
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
        />
      )}
    </div>
  );
}
