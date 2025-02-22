import React from 'react';
import { Message } from '@/types';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { ChevronLeft, ChevronRight, Tag, Package, Calendar } from "lucide-react";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MediaItem } from '@/types';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: Message[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  editMode?: boolean;
}

export const MediaViewer = ({
  isOpen,
  onClose,
  currentGroup,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  editMode = false
}: MediaViewerProps) => {
  // Convert Message[] to MediaItem[]
  const mediaItems: MediaItem[] = currentGroup.map(message => ({
    id: message.id,
    public_url: message.public_url,
    mime_type: message.mime_type,
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content,
    file_id: message.file_id,
    file_unique_id: message.file_unique_id,
    width: message.width,
    height: message.height,
    caption: message.caption
  }));

  const mainMedia = currentGroup?.find(media => media?.is_original_caption) || currentGroup?.[0];
  const analyzedContent = mainMedia?.analyzed_content;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      return '';
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPrevious && hasPrevious) onPrevious();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onNext && hasNext) onNext();
  };

  // Guard against undefined currentGroup
  if (!currentGroup || currentGroup.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] h-auto p-0 overflow-y-auto">
        <DialogTitle className="sr-only">Media Viewer</DialogTitle>
        
        <div className="relative flex flex-col bg-background dark:bg-background">
          {/* Image Container */}
          <div className="relative flex-1 min-h-0 bg-black/90">
            <div className="aspect-video w-full relative">
              <ImageSwiper media={mediaItems} />
              
              {/* Navigation Buttons Overlay */}
              <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={!hasPrevious}
                  className={cn(
                    "pointer-events-auto rounded-full bg-background/80 hover:bg-background/90 backdrop-blur",
                    !hasPrevious && "opacity-0"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  disabled={!hasNext}
                  className={cn(
                    "pointer-events-auto rounded-full bg-background/80 hover:bg-background/90 backdrop-blur",
                    !hasNext && "opacity-0"
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-6 space-y-4">
            {/* Product Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mainMedia?.purchase_order && (
                <div className="bg-secondary/10 rounded-lg p-4 flex items-center space-x-3 hover:bg-secondary/20 transition-colors">
                  <Tag className="w-5 h-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">Order ID</p>
                    <p className="text-base font-medium truncate">{mainMedia.purchase_order}</p>
                  </div>
                </div>
              )}
              
              {analyzedContent?.quantity && (
                <div className="bg-secondary/10 rounded-lg p-4 flex items-center space-x-3 hover:bg-secondary/20 transition-colors">
                  <Package className="w-5 h-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">Quantity</p>
                    <p className="text-base font-medium truncate">{analyzedContent.quantity}</p>
                  </div>
                </div>
              )}

              {analyzedContent?.purchase_date && (
                <div className="bg-secondary/10 rounded-lg p-4 flex items-center space-x-3 hover:bg-secondary/20 transition-colors">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">Purchase Date</p>
                    <p className="text-base font-medium truncate">
                      {formatDate(analyzedContent.purchase_date)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Caption or Additional Info */}
            {mainMedia?.caption && (
              <div className="mt-4 p-4 bg-secondary/5 rounded-lg">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{mainMedia.caption}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
