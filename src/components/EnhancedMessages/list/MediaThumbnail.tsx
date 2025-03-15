
import React from 'react';
import { FileX, Film } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Message } from '@/types';
import { isVideoMessage } from '../utils/mediaUtils';

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

  return (
    <div 
      className="w-12 h-12 sm:w-16 sm:h-16 rounded overflow-hidden bg-muted/20 flex-shrink-0 relative"
      onClick={(e) => {
        e.stopPropagation();
        onView();
      }}
    >
      {message.public_url && !hasError ? (
        isVideo ? (
          // Video thumbnail with overlay icon
          <div className="w-full h-full relative">
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
              <Film className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        ) : (
          // Image
          <img 
            src={message.public_url} 
            alt={message.caption || 'Media'} 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )
      ) : (
        // Error or no media fallback
        <div className="flex items-center justify-center h-full">
          <FileX className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      
      {/* Video indicator badge */}
      {isVideo && !hasError && (
        <Badge 
          variant="secondary" 
          className="absolute top-0 right-0 text-[8px] px-1 py-0 h-4"
        >
          Video
        </Badge>
      )}
    </div>
  );
};
