
import React from 'react';
import { cn } from '@/lib/utils';
import { Message } from '@/types/entities/Message';

interface ImageViewerProps {
  src: string;
  alt: string;
  message: Message;
  className?: string;
  onError?: () => void;
  onLoad?: () => void;
}

export function ImageViewer({
  src,
  alt,
  message,
  className,
  onError,
  onLoad
}: ImageViewerProps) {
  return (
    <div className={cn("relative flex items-center justify-center h-full w-full", className)}>
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onError={() => onError?.()}
        onLoad={() => onLoad?.()}
      />
    </div>
  );
}
