
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { Message } from "@/types/MessagesTypes";
import { Button } from "@/components/ui/button";
import { X, Download, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { MediaItem } from "@/types/ui/MediaItem";
import { CompactContentDisplay } from "./CompactContentDisplay";
import { useTouchInteraction } from "@/hooks/useTouchInteraction";

interface PublicGalleryDetailProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
  relatedMessages?: Message[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function PublicGalleryDetail({
  isOpen,
  onClose,
  message,
  relatedMessages = [],
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false
}: PublicGalleryDetailProps) {
  // Combine current message with related messages (for media groups)
  const allMessages = [message, ...relatedMessages.filter(m => m.id !== message.id)];
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Convert messages to MediaItems for the ImageSwiper
  const mediaItems: MediaItem[] = allMessages.map(msg => ({
    id: msg.id,
    public_url: msg.public_url,
    mime_type: msg.mime_type,
    file_unique_id: msg.file_unique_id,
    created_at: msg.created_at || '',
    caption: msg.caption,
    analyzed_content: msg.analyzed_content,
    width: msg.width,
    height: msg.height,
    duration: msg.duration,
    file_size: msg.file_size,
    content_disposition: msg.content_disposition as 'inline' | 'attachment',
    storage_path: msg.storage_path,
    processing_state: msg.processing_state
  }));

  // Current message being displayed
  const currentMessage = allMessages[currentIndex] || message;
  
  // Reset index when component opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen, message.id]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        } else if (hasPrevious && onPrevious) {
          onPrevious();
        }
      } else if (e.key === 'ArrowRight') {
        if (currentIndex < allMessages.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else if (hasNext && onNext) {
          onNext();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, allMessages.length, onPrevious, onNext, hasPrevious, hasNext]);

  // Handle touch interactions
  const { bindTouchHandlers } = useTouchInteraction({
    onSwipeLeft: () => {
      if (currentIndex < allMessages.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (hasNext && onNext) {
        onNext();
      }
    },
    onSwipeRight: () => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      } else if (hasPrevious && onPrevious) {
        onPrevious();
      }
    },
    preventDefaultOnSwipe: true
  });

  // Handle download of current media
  const handleDownload = () => {
    if (!currentMessage.public_url) return;
    
    const a = document.createElement('a');
    a.href = currentMessage.public_url;
    a.download = currentMessage.file_unique_id || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // External link to message (if available)
  const getMessageUrl = () => {
    if (!currentMessage.chat_id || !currentMessage.telegram_message_id) return null;
    
    // Format Telegram URL
    return `https://t.me/c/${currentMessage.chat_id.toString().replace("-100", "")}/${currentMessage.telegram_message_id}`;
  };
  
  const messageUrl = getMessageUrl();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent 
        className="max-w-6xl p-0 overflow-hidden border-none bg-background/95 backdrop-blur-md"
        {...bindTouchHandlers}
      >
        <div className="flex flex-col md:flex-row h-[90vh]">
          {/* Media display area */}
          <div className="relative flex-1 flex items-center justify-center bg-black/50">
            {/* Close button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute top-2 right-2 z-50 text-white rounded-full bg-black/40 hover:bg-black/60"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Actions */}
            <div className="absolute top-2 left-2 z-50 flex gap-2">
              {messageUrl && (
                <a 
                  href={messageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full h-9 w-9 bg-black/40 hover:bg-black/60 text-white"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
              )}
              
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white rounded-full bg-black/40 hover:bg-black/60"
                onClick={handleDownload}
              >
                <Download className="h-5 w-5" />
              </Button>
            </div>

            {/* Media navigation */}
            {hasPrevious && onPrevious && currentIndex === 0 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 rounded-full bg-black/40 hover:bg-black/60 text-white"
                onClick={onPrevious}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            
            {hasNext && onNext && currentIndex === allMessages.length - 1 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 rounded-full bg-black/40 hover:bg-black/60 text-white"
                onClick={onNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}

            {/* Media content */}
            <div className="w-full h-full max-h-screen flex items-center justify-center p-4">
              <ImageSwiper 
                media={mediaItems} 
                showNavigation={true}
                className="max-h-full" 
                onIndexChange={setCurrentIndex}
              />
            </div>
          </div>
          
          {/* Information sidebar */}
          <div className="w-full md:w-80 p-4 overflow-y-auto border-l bg-background">
            <h2 className="text-xl font-semibold mb-2 line-clamp-2">
              {currentMessage.analyzed_content?.product_name || currentMessage.caption || 'Untitled'}
            </h2>
            
            {/* Creation date */}
            {currentMessage.created_at && (
              <p className="text-sm text-muted-foreground mb-4">
                {new Date(currentMessage.created_at).toLocaleDateString()}
              </p>
            )}
            
            {/* Caption */}
            {currentMessage.caption && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-1">Description</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {currentMessage.caption}
                </p>
              </div>
            )}
            
            {/* Analyzed content */}
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Product Details</h3>
              <CompactContentDisplay content={currentMessage.analyzed_content} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
