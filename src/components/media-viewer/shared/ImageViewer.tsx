
import React, { useState } from 'react';
import { ZoomIn, ZoomOut, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { 
  Sheet, 
  SheetContent, 
  SheetClose 
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useMobile';
import { Message } from '@/types/entities/Message';

interface ImageViewerProps {
  src: string;
  alt?: string;
  message: Message;
  className?: string;
}

export function ImageViewer({ src, alt, message, className }: ImageViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [fullscreenSheetOpen, setFullscreenSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setError('Failed to load image');
    console.error('Image load error:', message.id, src);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
  };

  const toggleZoom = () => {
    if (isMobile) {
      setFullscreenSheetOpen(!fullscreenSheetOpen);
    } else {
      setIsZoomed(!isZoomed);
    }
  };

  const ImageDisplay = ({ fullscreen = false }) => (
    <img 
      src={src} 
      alt={alt || "Media"}
      className={cn(
        "transition-all duration-300 ease-in-out rounded-md",
        fullscreen || isZoomed
          ? "max-w-none max-h-none object-contain w-full h-full" 
          : "max-w-[85%] max-h-[85%] object-contain mx-auto"
      )}
      onLoad={handleLoadSuccess}
      onError={handleLoadError}
    />
  );

  const MobileFullscreenSheet = () => (
    <Sheet open={fullscreenSheetOpen} onOpenChange={setFullscreenSheetOpen}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] p-0 flex flex-col justify-center rounded-t-lg border-t"
      >
        <SheetClose className="absolute right-4 top-4 z-50">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full bg-background/40 hover:bg-background/60"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetClose>
        <div className="flex items-center justify-center w-full h-full">
          <ImageDisplay fullscreen={true} />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
      {/* Loading state */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 rounded-md">
          <Spinner size="lg" className="mb-2" />
          <p className="text-sm">Loading image...</p>
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
      {!isLoading && !error && (
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
      {isZoomed && !isMobile && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleZoom}
          className="absolute top-2 left-2 z-30 h-8 w-8 rounded-full bg-background/40 hover:bg-background/60"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      {/* Image content */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out w-full h-full flex items-center justify-center",
          {
            "fixed inset-0 bg-background/90 z-50 p-4": isZoomed && !isMobile,
          }
        )}
        onClick={isMobile ? toggleZoom : undefined}
      >
        <ImageDisplay />
      </div>
      
      {/* Mobile fullscreen sheet */}
      {isMobile && <MobileFullscreenSheet />}
    </div>
  );
}
