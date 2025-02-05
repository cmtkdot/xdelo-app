import React from 'react';
import { MediaItem } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

          <div className="p-4 space-y-3">
            {/* Caption section */}
            {(analyzedContent?.quantity || mainMedia.caption) && (
              <div className="border-b border-border pb-3">
                <p className="text-sm text-muted-foreground font-medium mb-1">Caption</p>
                <p className="text-foreground text-sm">{analyzedContent?.quantity || mainMedia.caption}</p>
              </div>
            )}

            {/* Two column grid for other information */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {analyzedContent?.product_code && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">PO Number</p>
                  <p className="text-foreground">PO#{analyzedContent.product_code}</p>
                </div>
              )}
              {analyzedContent?.vendor_uid && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Vendor</p>
                  <p className="text-foreground">{analyzedContent.vendor_uid}</p>
                </div>
              )}
              {analyzedContent?.purchase_date && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Purchase Date</p>
                  <p className="text-foreground">{formatDate(analyzedContent.purchase_date)}</p>
                </div>
              )}
              {mainMedia.created_at && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Created</p>
                  <p className="text-foreground">{formatDate(mainMedia.created_at)}</p>
                </div>
              )}
            </div>

            {analyzedContent?.notes && (
              <div className="pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground font-medium mb-1">Notes</p>
                <p className="text-foreground text-sm">{analyzedContent.notes}</p>
              </div>
            )}

            <div className="flex justify-between pt-3 border-t border-border">
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
