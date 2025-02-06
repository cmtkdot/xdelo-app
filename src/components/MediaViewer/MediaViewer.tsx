
import React from 'react';
import { MediaItem } from '@/types';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { ChevronLeft, ChevronRight, Tag, Package, Calendar } from "lucide-react";
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
        <DialogTitle className="sr-only">Media Viewer</DialogTitle>
        <div className="relative flex flex-col bg-background dark:bg-background">
          <div className="flex-1 min-h-0 bg-black/90">
            <div className="aspect-video w-full">
              <ImageSwiper media={currentGroup} />
            </div>
          </div>

          <div className="p-4 space-y-2">
            {/* Product Details Grid */}
            <div className="grid grid-cols-2 gap-2">
              {mainMedia.purchase_order && (
                <div className="bg-secondary/10 rounded-lg p-2 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                  <Tag className="w-4 h-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Order ID</p>
                    <p className="text-sm font-medium truncate">{mainMedia.purchase_order}</p>
                  </div>
                </div>
              )}
              
              {analyzedContent?.quantity && (
                <div className="bg-secondary/10 rounded-lg p-2 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                  <Package className="w-4 h-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="text-sm font-medium truncate">{analyzedContent.quantity}</p>
                  </div>
                </div>
              )}

              {analyzedContent?.purchase_date && (
                <div className="bg-secondary/10 rounded-lg p-2 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
                  <Calendar className="w-4 h-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Purchase Date</p>
                    <p className="text-sm font-medium truncate">
                      {formatDate(analyzedContent.purchase_date)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onPrevious) onPrevious();
                }}
                disabled={!hasPrevious}
                size="sm"
                className="bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onNext) onNext();
                }}
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
