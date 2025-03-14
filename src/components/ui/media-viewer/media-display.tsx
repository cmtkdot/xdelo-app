
'use client'

import React, { useState } from 'react';
import { Message } from '@/types/MessagesTypes';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface MediaDisplayProps {
  message: Message;
  className?: string;
}

export function MediaDisplay({ message, className }: MediaDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className={cn("relative w-full h-full flex items-center justify-center bg-black", className)}>
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
        <img 
          src={message.public_url} 
          alt={message.caption || "Media"}
          className="max-w-full max-h-full object-contain" 
          onLoad={handleLoadSuccess}
          onError={() => handleLoadError('image')}
        />
      )}
    </div>
  );
}
