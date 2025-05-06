import React, { useState, useEffect } from 'react';
import { FileText, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VideoThumbnailProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
  onError?: () => void;
  onClick?: () => void;
}

/**
 * VideoThumbnail component for consistent video preview thumbnails across the app
 * Uses placeholder for videos that can't be processed due to CORS restrictions
 */
export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  src,
  alt = 'Video preview',
  className,
  width = 64,
  height = 64,
  onLoad,
  onError,
  onClick
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      onError?.();
      return;
    }

    // For videos hosted on Supabase, we can't generate thumbnails due to CORS
    // Just simulate loading and show the placeholder instead
    const isSupabaseUrl = src.includes('supabase.co');
    
    if (isSupabaseUrl) {
      // Small timeout to prevent flickering
      const timer = setTimeout(() => {
        setIsLoading(false);
        onLoad?.(); // We still count this as "loaded" even though we're showing a placeholder
      }, 300);
      
      return () => clearTimeout(timer);
    }
    
    // Only attempt thumbnail generation for non-Supabase URLs
    // This part is disabled for now since most videos are on Supabase
    setIsLoading(false);
    onLoad?.();

  }, [src, onLoad, onError]);

  // Display loading state
  if (isLoading) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted/20 rounded-md overflow-hidden",
          className
        )}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <div className="animate-pulse flex flex-col items-center justify-center">
          <Video className="h-5 w-5 text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/50 mt-1">Loading</span>
        </div>
      </div>
    );
  }

  // Display video placeholder with play indicator
  return (
    <div 
      className={cn(
        "relative rounded-md overflow-hidden bg-black/5", 
        className
      )}
      style={{ width: `${width}px`, height: `${height}px` }}
      onClick={onClick}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center">
            <Video className="h-6 w-6 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/60 mt-1">Video</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-0.5">
        <Video className="h-3 w-3 text-white" />
      </div>
    </div>
  );
};
