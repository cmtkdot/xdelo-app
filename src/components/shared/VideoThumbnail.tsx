import React, { useState, useEffect } from 'react';
import { FileText, Play, Video } from 'lucide-react';
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
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setIsLoading(false);
      onError?.();
      return;
    }

    // For videos hosted on Supabase, try to generate thumbnails using a different approach
    const isSupabaseUrl = src.includes('supabase.co');
    
    if (isSupabaseUrl) {
      // Try to use static thumbnail from Supabase if available (pattern conversion)
      // Convert video URL to possible thumbnail URL by changing extension
      const thumbnailUrl = src.replace(/\.(mp4|mov|avi|wmv)$/i, '.jpg');
      
      // Load the image to check if it exists
      const img = new Image();
      img.onload = () => {
        setThumbnailUrl(thumbnailUrl);
        setIsLoading(false);
        onLoad?.();
      };
      
      img.onerror = () => {
        // If no thumbnail available, show placeholder
        setThumbnailUrl(null);
        setIsLoading(false);
        onLoad?.(); // We still count this as "loaded" even though we're showing a placeholder
      };
      
      img.src = thumbnailUrl;
      return;
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

  // If we have a thumbnail, display it
  if (thumbnailUrl) {
    return (
      <div 
        className={cn(
          "relative rounded-md overflow-hidden", 
          className
        )}
        style={{ width: `${width}px`, height: `${height}px` }}
        onClick={onClick}
      >
        <img 
          src={thumbnailUrl} 
          alt={alt} 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
          <div className="bg-black/50 rounded-full p-1">
            <Play className="h-4 w-4 text-white" fill="white" />
          </div>
        </div>
      </div>
    );
  }

  // Display video placeholder with play indicator
  return (
    <div 
      className={cn(
        "relative rounded-md overflow-hidden bg-muted/20", 
        className
      )}
      style={{ width: `${width}px`, height: `${height}px` }}
      onClick={onClick}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center">
          <div className="bg-black/40 rounded-full p-1.5">
            <Play className="h-5 w-5 text-white" fill="white" />
          </div>
        </div>
      </div>
      <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-0.5">
        <Video className="h-3 w-3 text-white" />
      </div>
    </div>
  );
};
