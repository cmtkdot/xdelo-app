
import React, { useState } from 'react';
import { Film, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Spinner } from '@/components/ui/spinner';
import { Message } from '@/types/entities/Message';

interface VideoPlayerProps {
  src: string;
  message: Message;
  className?: string;
}

export function VideoPlayer({ src, message, className }: VideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setError('Failed to load video');
    console.error('Video load error:', message.id, src);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <Spinner size="lg" className="mb-2" />
          <p className="text-sm">Loading video...</p>
        </div>
      )}
      
      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="bg-background/90 px-6 py-4 rounded-lg shadow-lg flex flex-col items-center">
            <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
            <p className="text-center mb-3">{error}</p>
            <p className="text-xs text-center mb-3 text-muted-foreground">
              The video format may not be supported by your browser or the file may be corrupted.
            </p>
            <button 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              onClick={handleRetry}
            >
              <RefreshCw className="h-4 w-4 mr-2 inline" />
              Retry
            </button>
          </div>
        </div>
      )}
      
      {/* Video player */}
      <AspectRatio ratio={16/9} className="w-full h-auto overflow-hidden rounded-md">
        <video
          src={src}
          className="w-full h-full object-contain rounded-md"
          controls
          playsInline
          onLoadedData={handleLoadSuccess}
          onError={handleLoadError}
          controlsList="nodownload"
          poster="/placeholder.svg"
        />
      </AspectRatio>
    </div>
  );
}
