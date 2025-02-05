import React from 'react';
import { MediaItem } from '@/types';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { ChevronLeft, ChevronRight, Calendar, MessageSquare, Package } from "lucide-react";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: MediaItem[];
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export const MediaViewer = ({
  isOpen,
  onClose,
  currentGroup,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false
}: MediaViewerProps) => {
  const mainMedia = currentGroup.find(media => media.is_original_caption) || currentGroup[0];
  const analyzedContent = mainMedia?.analyzed_content;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl w-[90vw] max-h-[80vh] h-auto p-0 overflow-y-auto">
        <div className="relative flex flex-col bg-background dark:bg-background">
          <div className="flex-1 min-h-0 bg-black/90">
            <div className="aspect-video w-full">
              <ImageSwiper media={currentGroup} />
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Caption and Purchase Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mainMedia.caption && (
                <div className="bg-secondary/10 rounded-lg p-3 flex items-start space-x-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">Caption</p>
                    <p className="text-sm text-foreground truncate">{mainMedia.caption}</p>
                  </div>
                </div>
              )}
              {analyzedContent?.purchase_date && (
                <div className="bg-secondary/10 rounded-lg p-3 flex items-start space-x-2">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium mb-0.5">Purchase Date</p>
                    <p className="text-sm text-foreground font-medium">
                      {formatDate(analyzedContent.purchase_date)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Product Information Row */}
            <div className="grid grid-cols-2 gap-3">
              {mainMedia.purchase_order && (
                <div className="bg-secondary/10 rounded-lg p-3 flex items-center space-x-2">
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Purchase Order</p>
                    <p className="text-sm text-foreground font-medium truncate">{mainMedia.purchase_order}</p>
                  </div>
                </div>
              )}
              {analyzedContent?.quantity && (
                <div className="bg-secondary/10 rounded-lg p-3 flex items-center space-x-2">
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Quantity</p>
                    <p className="text-sm text-foreground font-medium">{analyzedContent.quantity}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={!hasPrevious}
                size="sm"
                className="bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={onNext}
                disabled={!hasNext}
                size="sm"
                className="bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};