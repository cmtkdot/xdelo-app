
import React from 'react';
import { cn } from '@/lib/utils';
import { VideoPlayer } from './VideoPlayer';
import { ImageViewer } from './ImageViewer';
import { MediaDisplayProps } from '../types';

export function MediaDisplay({ message, className }: MediaDisplayProps) {
  if (!message || !message.public_url) {
    return (
      <div className="flex items-center justify-center w-full h-full rounded-md bg-muted/20">
        <span className="text-muted-foreground">Media not available</span>
      </div>
    );
  }

  // Determine if this is a video based on mime type or URL
  const isVideo = message.mime_type?.startsWith('video/') || 
                 (message.public_url && /\.(mp4|mov|webm|avi)$/i.test(message.public_url));

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
        />
      ) : (
        <ImageViewer
          src={message.public_url}
          alt={message.caption || "Media"}
          message={message}
          className="w-full h-full"
        />
      )}
    </div>
  );
}
