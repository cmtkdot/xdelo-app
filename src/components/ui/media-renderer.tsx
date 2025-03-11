
import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMediaFixer } from '@/hooks/useMediaFixer';

export interface MediaRendererProps {
  src: string;
  type?: 'image' | 'video' | 'audio' | 'document' | 'auto';
  mimeType?: string;
  messageId?: string;
  storagePath?: string;
  className?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
  showControls?: boolean;
  onError?: () => void;
}

export function MediaRenderer({
  src,
  type = 'auto',
  mimeType,
  messageId,
  storagePath,
  className = '',
  width = 'auto',
  height = 'auto',
  alt = 'Media content',
  showControls = true,
  onError
}: MediaRendererProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { fixMediaContentType, redownloadMedia, isRepairing } = useMediaFixer();

  // Determine media type from mime type if not specified
  const getMediaType = () => {
    if (type !== 'auto') return type;
    
    if (!mimeType) {
      // Try to guess from URL
      if (src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
      if (src.match(/\.(mp4|webm|mov)$/i)) return 'video';
      if (src.match(/\.(mp3|wav|ogg)$/i)) return 'audio';
      return 'document';
    }
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const mediaType = getMediaType();

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    if (onError) onError();
  };

  const handleFix = async () => {
    if (!storagePath) return;
    
    const success = await fixMediaContentType(storagePath);
    if (success) {
      // Reset state and try to load again
      setIsLoading(true);
      setHasError(false);
    }
  };

  const handleRedownload = async () => {
    if (!messageId) return;
    
    const success = await redownloadMedia(messageId);
    if (success) {
      // Reset state and try to load again
      setIsLoading(true);
      setHasError(false);
    }
  };

  const renderMedia = () => {
    if (isLoading) {
      return <Skeleton style={{ width, height }} className={`rounded-md ${className}`} />;
    }

    if (hasError) {
      return (
        <div className={`flex flex-col items-center justify-center bg-gray-100 rounded-md p-4 ${className}`} style={{ width, height: 'auto', minHeight: '100px' }}>
          <p className="text-sm text-gray-500 mb-2">Media failed to load</p>
          <div className="flex gap-2">
            {storagePath && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleFix} 
                disabled={isRepairing}
              >
                Fix Content Type
              </Button>
            )}
            {messageId && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleRedownload} 
                disabled={isRepairing}
              >
                Redownload
              </Button>
            )}
          </div>
        </div>
      );
    }

    switch (mediaType) {
      case 'image':
        return (
          <img 
            src={src} 
            alt={alt} 
            className={`rounded-md object-contain ${className}`}
            style={{ width, height, maxWidth: '100%' }}
            onLoad={handleLoad}
            onError={handleError}
          />
        );
      case 'video':
        return (
          <video 
            src={src}
            controls={showControls}
            className={`rounded-md ${className}`}
            style={{ width, height, maxWidth: '100%' }}
            onLoadedData={handleLoad}
            onError={handleError}
          />
        );
      case 'audio':
        return (
          <audio 
            src={src}
            controls={showControls}
            className={`rounded-md w-full ${className}`}
            onLoadedData={handleLoad}
            onError={handleError}
          />
        );
      case 'document':
      default:
        return (
          <div className={`flex flex-col items-center bg-gray-100 rounded-md p-4 ${className}`}>
            <p className="text-sm mb-2">Document</p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => window.open(src, '_blank')}
            >
              Open Document
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="media-renderer">
      {renderMedia()}
    </div>
  );
}
