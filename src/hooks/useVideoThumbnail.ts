
import { useState, useEffect } from 'react';
import { Message } from '@/types';
import { getVideoMetadata } from '@/utils/mediaUtils';

interface UseVideoThumbnailResult {
  thumbnailUrl: string | null;
  isLoading: boolean;
  hasError: boolean;
  generateThumbnail: () => void;
}

export function useVideoThumbnail(message: Message): UseVideoThumbnailResult {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const generateThumbnail = () => {
    if (!message?.public_url || thumbnailUrl || isLoading) return;
    
    setIsLoading(true);
    setHasError(false);
    
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = message.public_url;
    video.muted = true;
    video.preload = 'metadata';
    
    // Get video metadata for better seek position
    const videoMetadata = getVideoMetadata(message);
    // Try to seek to a good frame (around 20% of the video duration)
    const seekTo = videoMetadata?.duration 
      ? Math.min(videoMetadata.duration * 0.2, 5) 
      : message.duration 
        ? Math.min(message.duration * 0.2, 5) 
        : 1;
    
    const onError = () => {
      console.error('Error generating video thumbnail:', message.id);
      setHasError(true);
      setIsLoading(false);
    };
    
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = seekTo;
    });
    
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          setThumbnailUrl(dataUrl);
          setIsLoading(false);
        } else {
          onError();
        }
      } catch (err) {
        console.error('Error generating canvas thumbnail:', err);
        onError();
      }
    });
    
    video.addEventListener('error', onError);
    
    // Set a timeout to prevent hanging on load issues
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        onError();
      }
    }, 5000);
    
    return () => clearTimeout(timeoutId);
  };
  
  // Auto-generate thumbnail when message changes
  useEffect(() => {
    // Reset states when message changes
    setThumbnailUrl(null);
    setHasError(false);
    setIsLoading(false);
  }, [message?.id]);
  
  return {
    thumbnailUrl,
    isLoading,
    hasError,
    generateThumbnail
  };
}
