
import React, { useEffect } from 'react';
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageIcon, FileIcon, Play } from "lucide-react";
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { isVideoMessage } from '@/utils/mediaUtils';
import { useVideoThumbnail } from '@/hooks/useVideoThumbnail';

interface MediaThumbnailProps {
  message: Message;
  hasError: boolean;
  onView: () => void;
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({ 
  message, 
  hasError,
  onView
}) => {
  const isVideo = isVideoMessage(message);
  const { thumbnailUrl, isLoading, hasError: thumbError, generateThumbnail } = useVideoThumbnail(message);
  
  // Auto-generate thumbnail for videos when component mounts
  useEffect(() => {
    if (isVideo && !thumbnailUrl && !thumbError) {
      generateThumbnail();
    }
  }, [isVideo, message.id, thumbnailUrl, thumbError, generateThumbnail]);
  
  return (
    <div 
      className="relative h-16 w-16 flex-shrink-0 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onView();
      }}
    >
      <AspectRatio ratio={1} className="h-full w-full overflow-hidden rounded-md bg-muted/50">
        {hasError || thumbError ? (
          <div className="flex h-full w-full items-center justify-center">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : isVideo && thumbnailUrl ? (
          <div className="relative h-full w-full">
            <img
              src={thumbnailUrl}
              alt={message.caption || "Video thumbnail"}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 p-2">
                <Play className="h-3 w-3 text-white fill-white" />
              </div>
            </div>
          </div>
        ) : message.public_url ? (
          <div className="relative h-full w-full">
            <img
              src={message.public_url}
              alt={message.caption || "Media"}
              className="h-full w-full object-cover"
              onError={() => console.log(`Error loading image: ${message.id}`)}
            />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/60 p-2">
                  <Play className="h-3 w-3 text-white fill-white" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/30">
            <div className="h-4 w-4 rounded-full border-2 border-t-transparent border-primary animate-spin"></div>
          </div>
        )}
      </AspectRatio>
    </div>
  );
};
