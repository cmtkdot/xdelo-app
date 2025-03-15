
import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Play, FileX } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Message } from '@/types';

interface VideoThumbnailProps {
  message: Message;
  thumbnailUrl?: string;
  isLoading: boolean;
  onGenerate: () => void;
  onError: () => void;
  hasError: boolean;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  message,
  thumbnailUrl,
  isLoading,
  onGenerate,
  onError,
  hasError
}) => {
  if (thumbnailUrl && !hasError) {
    return (
      <>
        <img 
          src={thumbnailUrl} 
          alt={message.caption || 'Video thumbnail'} 
          className="w-full h-full object-cover"
          onError={onError}
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div className="rounded-full bg-black/50 p-3 backdrop-blur-sm">
            <Play className="h-6 w-6 text-white" fill="white" />
          </div>
        </div>
        <Badge className="absolute top-2 right-2 bg-black/70 text-white">
          {message.duration ? `${Math.floor(message.duration)}s` : 'Video'}
        </Badge>
      </>
    );
  }
  
  if (!hasError) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-full" 
        onClick={(e) => {
          e.stopPropagation();
          if (!isLoading) {
            onGenerate();
          }
        }}
      >
        <Play className="h-10 w-10 text-muted-foreground mb-2" />
        <span className="text-muted-foreground text-xs text-center px-2">
          {isLoading ? 'Loading preview...' : 'Click to load preview'}
        </span>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <FileX className="h-8 w-8 text-muted-foreground mb-2" />
      <span className="text-muted-foreground text-xs text-center px-2">
        Video preview failed
      </span>
      <Badge className="mt-2">Video</Badge>
    </div>
  );
};
