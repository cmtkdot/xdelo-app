
import React from 'react';
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ImageIcon, FileIcon } from "lucide-react";
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { isVideoMessage } from '@/utils/mediaUtils';

interface MediaThumbnailProps {
  message: Message;
  hasError: boolean;
  onView: () => void;  // Simplified callback
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({ 
  message, 
  hasError,
  onView
}) => {
  const isVideo = isVideoMessage(message);
  
  return (
    <div 
      className="relative h-16 w-16 flex-shrink-0 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onView();
      }}
    >
      <AspectRatio ratio={1} className="h-full w-full overflow-hidden rounded-md bg-muted/50">
        {hasError ? (
          <div className="flex h-full w-full items-center justify-center">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
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
                <div className="rounded-full bg-black/50 p-1">
                  <div className="h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white ml-0.5" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </AspectRatio>
    </div>
  );
};
