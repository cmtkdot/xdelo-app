
import React from 'react';
import { FileX } from 'lucide-react';
import { Message } from '@/types';

interface ImageThumbnailProps {
  message: Message;
  hasError: boolean;
  onError: () => void;
  onLoad: () => void;
}

export const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  message,
  hasError,
  onError,
  onLoad
}) => {
  if (message.public_url && !hasError) {
    return (
      <img 
        src={message.public_url} 
        alt={message.caption || 'Media'} 
        className="w-full h-full object-cover"
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
      />
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center h-full bg-muted/30">
      <FileX className="h-8 w-8 text-muted-foreground mb-2" />
      <span className="text-muted-foreground text-xs text-center px-2">
        {hasError ? 'Media failed to load' : 'No media available'}
      </span>
    </div>
  );
};
