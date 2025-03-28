
import React from 'react';
import { Message } from '@/types';
import { ImageIcon, VideoIcon } from 'lucide-react';

interface MediaThumbnailProps {
  message: Message;
  className?: string;
}

export function MediaThumbnail({ message, className }: MediaThumbnailProps) {
  const isVideo = message.mime_type?.startsWith('video/');

  return (
    <div className={`relative w-12 h-12 rounded overflow-hidden bg-gray-100 ${className}`}>
      <img
        src={message.public_url || '/placeholder.svg'}
        alt="Thumbnail"
        className="w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = '/placeholder.svg';
        }}
      />
      <div className="absolute bottom-0 right-0 bg-background/80 p-0.5 rounded-tl-sm">
        {isVideo ? (
          <VideoIcon className="h-3 w-3" />
        ) : (
          <ImageIcon className="h-3 w-3" />
        )}
      </div>
    </div>
  );
}
