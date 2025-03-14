
'use client'

import React, { useState } from 'react';
import { Message } from '@/types/MessagesTypes';
import { AlertCircle, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMobile';

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
      <div className="flex items-center justify-center w-full h-full bg-black">
        <span className="text-white/70">Media not available</span>
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
      "relative max-w-full max-h-full flex items-center justify-center bg-black", 
      className
    )}>
      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
          <Spinner size="lg" className="mb-2" />
          <p className="text-white text-sm">Loading media...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className="bg-black/80 text-white px-6 py-4 rounded-lg flex flex-col items-center">
            <AlertCircle className="h-8 w-8 mb-2 text-red-500" />
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
      
      {/* Zoom toggle button (only on mobile) */}
      {isMobile && !isLoading && !error && !isVideo && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleZoom}
          className="absolute top-2 right-2 z-30 h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
        >
          {isZoomed ? (
            <ZoomOut className="h-4 w-4" />
          ) : (
            <ZoomIn className="h-4 w-4" />
          )}
        </Button>
      )}
      
      {/* Media content */}
      {isVideo ? (
        <video
          src={message.public_url}
          className="max-w-full max-h-full object-contain"
          controls
          playsInline
          onLoadedData={handleLoadSuccess}
          onError={() => handleLoadError('video')}
        />
      ) : (
        <div className={cn(
          "transition-all duration-300 ease-in-out",
          {
            "max-w-full max-h-full": !isZoomed && isMobile,
            "w-full h-full": isZoomed,
            "cursor-zoom-in": !isZoomed && isMobile,
            "cursor-zoom-out": isZoomed && isMobile
          }
        )}>
          <img 
            src={message.public_url} 
            alt={message.caption || "Media"}
            className={cn(
              "transition-all duration-300 ease-in-out",
              isZoomed 
                ? "max-w-none max-h-none object-contain w-full" 
                : (isMobile ? "max-w-[85%] max-h-[85%] object-contain mx-auto" : "max-w-full max-h-full object-contain")
            )}
            onClick={isMobile ? toggleZoom : undefined}
            onLoad={handleLoadSuccess}
            onError={() => handleLoadError('image')}
          />
        </div>
      )}
    </div>
  );
}
