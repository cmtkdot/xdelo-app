import React from 'react';
import { MediaItem } from '@/types';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

          <div className="p-6 space-y-4">
            {/* Caption and Purchase Date Row */}
            <div className="flex justify-between items-start gap-4">
              {mainMedia.caption && (
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Caption</p>
                  <p className="text-foreground text-sm">{mainMedia.caption}</p>
                </div>
              )}
              {analyzedContent?.purchase_date && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground font-medium mb-1">Purchase Date</p>
                  <p className="text-foreground text-sm">{formatDate(analyzedContent.purchase_date)}</p>
                </div>
              )}
            </div>

            {/* Product Information Grid */}
            <div className="grid grid-cols-3 gap-4">
              {analyzedContent?.quantity && (
                <div className="bg-secondary/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Quantity</p>
                  <p className="text-foreground text-sm font-medium">{analyzedContent.quantity}</p>
                </div>
              )}
              {analyzedContent?.product_code && (
                <div className="bg-secondary/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">PO Number</p>
                  <p className="text-foreground text-sm font-medium">PO#{analyzedContent.product_code}</p>
                </div>
              )}
              {analyzedContent?.vendor_uid && (
                <div className="bg-secondary/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Vendor</p>
                  <p className="text-foreground text-sm font-medium">{analyzedContent.vendor_uid}</p>
                </div>
              )}
            </div>

            {/* Notes Section */}
            {analyzedContent?.notes && (
              <div className="bg-secondary/10 rounded-lg p-4 mt-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">Notes</p>
                <p className="text-foreground text-sm">{analyzedContent.notes}</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={!hasPrevious}
                size="sm"
                className="bg-secondary hover:bg-secondary/80"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={onNext}
                disabled={!hasNext}
                size="sm"
                className="bg-secondary hover:bg-secondary/80"
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