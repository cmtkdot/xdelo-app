
'use client'

import React, { useState } from 'react';
import { Message } from '@/types/MessagesTypes';
import { AlertCircle, RefreshCw, ZoomIn, ZoomOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMobile';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface MediaDisplayProps {
  message: Message;
  className?: string;
}

export function MediaDisplay({ message, className }: MediaDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const isMobile = useIsMobile();

  // Safety check for valid message
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

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
  };

  const handleLoadSuccess = () => {
    setIsLoading(false);
  };

  const handleLoadError = (type: 'image' | 'video') => {
    setIsLoading(false);
    setError(`Failed to load ${type}`);
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };

  return (
    <div className={cn(
      "relative w-full h-full flex items-center justify-center overflow-hidden bg-muted/20 rounded-md", 
      className
    )}>
      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-md">
          <Spinner size="lg" className="mb-2" />
          <p className="text-sm">Loading media...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-20 rounded-md">
          <div className="bg-background/90 px-6 py-4 rounded-lg shadow-lg flex flex-col items-center">
            <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
            <p className="text-center mb-3">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {/* Zoom toggle button */}
      {!isLoading && !error && !isVideo && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleZoom}
          className={cn(
            "absolute top-2 right-2 z-30 h-8 w-8 rounded-full bg-background/40 hover:bg-background/60",
            isZoomed && "bg-background/60"
          )}
        >
          {isZoomed ? (
            <ZoomOut className="h-4 w-4" />
          ) : (
            <ZoomIn className="h-4 w-4" />
          )}
        </Button>
      )}
      
      {/* Exit zoom button when zoomed */}
      {isZoomed && !isVideo && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleZoom}
          className="absolute top-2 left-2 z-30 h-8 w-8 rounded-full bg-background/40 hover:bg-background/60"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      {/* Media content */}
      {isVideo ? (
        <div className="w-full max-h-full flex items-center justify-center">
          <AspectRatio ratio={16/9} className="w-full max-w-[95%] h-auto">
            <video
              src={message.public_url}
              className="w-full h-full object-contain rounded-md"
              controls
              playsInline
              onLoadedData={handleLoadSuccess}
              onError={() => handleLoadError('video')}
              controlsList="nodownload"
            />
          </AspectRatio>
        </div>
      ) : (
        <div 
          className={cn(
            "transition-all duration-300 ease-in-out w-full h-full flex items-center justify-center",
            {
              "fixed inset-0 bg-background/90 z-50 p-4": isZoomed && isMobile,
            }
          )}
          onClick={isMobile && !isZoomed ? toggleZoom : undefined}
        >
          <img 
            src={message.public_url} 
            alt={message.caption || "Media"}
            className={cn(
              "transition-all duration-300 ease-in-out rounded-md",
              isZoomed 
                ? "max-w-none max-h-none object-contain w-full h-full" 
                : "max-w-[85%] max-h-[85%] object-contain mx-auto"
            )}
            onLoad={handleLoadSuccess}
            onError={() => handleLoadError('image')}
          />
        </div>
      )}
    </div>
  );
}
