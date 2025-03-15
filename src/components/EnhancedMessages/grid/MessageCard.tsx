
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { CardActions } from './CardActions';
import { VideoThumbnail } from './VideoThumbnail';
import { ImageThumbnail } from './ImageThumbnail';
import { isVideoMessage, getProcessingStateColor } from '../utils/mediaUtils';

interface MessageCardProps {
  message: Message;
  onSelect: (message: Message) => void;
  onView: (messageGroup: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  isSelected?: boolean;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  onSelect,
  onView,
  onEdit,
  onDelete,
  isSelected
}) => {
  const [hasMediaError, setHasMediaError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  
  // Handle media load error
  const handleMediaError = () => {
    console.log(`Media load error for message: ${message.id}`);
    setHasMediaError(true);
    setIsLoading(false);
  };

  // Generate video thumbnail
  const generateVideoThumbnail = () => {
    if (!message.public_url || videoThumbnail) return;
    
    setIsLoading(true);
    
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = message.public_url;
    video.muted = true;
    video.preload = 'metadata';
    
    // Try to seek to the middle or start of the video
    const seekTo = message.duration ? message.duration / 2 : 1;
    
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
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          setVideoThumbnail(thumbnailUrl);
          setIsLoading(false);
        } else {
          handleMediaError();
        }
      } catch (err) {
        console.error('Error generating thumbnail:', err);
        handleMediaError();
      }
    });
    
    video.addEventListener('error', () => {
      handleMediaError();
    });
    
    // Set a timeout to prevent hanging on load issues
    setTimeout(() => {
      if (isLoading) {
        handleMediaError();
      }
    }, 5000);
  };

  // Generate thumbnails for visible videos
  useEffect(() => {
    if (isVideoMessage(message) && !videoThumbnail && !hasMediaError) {
      generateVideoThumbnail();
    }
  }, [message, videoThumbnail, hasMediaError]);

  return (
    <Card 
      key={message.id} 
      className={cn(
        "overflow-hidden transition-all hover:shadow-md cursor-pointer group",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onSelect(message)}
    >
      <div className="relative aspect-square overflow-hidden bg-muted/20">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/40 z-10">
            <Skeleton className="h-full w-full absolute" />
          </div>
        )}
        
        {isVideoMessage(message) ? (
          <VideoThumbnail 
            message={message}
            thumbnailUrl={videoThumbnail || undefined}
            isLoading={isLoading}
            onGenerate={generateVideoThumbnail}
            onError={handleMediaError}
            hasError={hasMediaError}
          />
        ) : (
          <ImageThumbnail 
            message={message}
            hasError={hasMediaError}
            onError={handleMediaError}
            onLoad={() => setIsLoading(false)}
          />
        )}
        
        <CardActions 
          message={message}
          onView={() => onView([message])}
          onEdit={onEdit}
          onDelete={onDelete}
        />
        
        {/* Processing state badge */}
        {message.processing_state && (
          <Badge 
            className={cn(
              "absolute bottom-2 left-2 text-xs font-normal px-1.5 py-0.5",
              getProcessingStateColor(message.processing_state)
            )}
          >
            {message.processing_state}
          </Badge>
        )}
      </div>
      
      <CardContent className="p-2 space-y-2">
        <div className="line-clamp-2 text-xs font-medium">
          {message.caption || "No caption"}
        </div>
        
        <div className="flex flex-wrap gap-1 items-center text-[10px] text-muted-foreground">
          <span>
            {new Date(message.created_at || '').toLocaleDateString()}
          </span>
          {message.analyzed_content?.vendor_uid && (
            <Badge variant="outline" className="text-[9px] h-4 px-1">
              {message.analyzed_content.vendor_uid}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
