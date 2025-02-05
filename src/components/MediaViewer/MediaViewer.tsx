
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
      <DialogContent className="max-w-4xl h-[90vh] p-0 dark:bg-transparent">
        <div className="relative h-full flex flex-col">
          <DialogHeader className="border-b border-border px-6 py-4 bg-background dark:bg-transparent">
            <DialogTitle className="text-base font-medium">
              {analyzedContent?.product_name || 'Untitled Product'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 bg-black/90">
            <ImageSwiper media={currentGroup} />
          </div>

          <div className="p-6 bg-background dark:bg-transparent border-t space-y-4">
            {/* Caption section */}
            {mainMedia.caption && (
              <div className="border-b border-border pb-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">Caption</p>
                <p className="text-foreground whitespace-pre-wrap">{mainMedia.caption}</p>
              </div>
            )}

            {/* Two column grid for other information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {analyzedContent?.product_code && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">PO Number</p>
                  <p className="text-foreground">PO#{analyzedContent.product_code}</p>
                </div>
              )}
              {analyzedContent?.vendor_uid && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Vendor</p>
                  <p className="text-foreground">{analyzedContent.vendor_uid}</p>
                </div>
              )}
              {analyzedContent?.quantity && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Quantity</p>
                  <p className="text-foreground">{analyzedContent.quantity}</p>
                </div>
              )}
              {analyzedContent?.purchase_date && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Purchase Date</p>
                  <p className="text-foreground">{formatDate(analyzedContent.purchase_date)}</p>
                </div>
              )}
              {mainMedia.created_at && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Created</p>
                  <p className="text-foreground">{formatDate(mainMedia.created_at)}</p>
                </div>
              )}
              {mainMedia.updated_at && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Updated</p>
                  <p className="text-foreground">{formatDate(mainMedia.updated_at)}</p>
                </div>
              )}
              {mainMedia.processing_state && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Processing State</p>
                  <p className="text-foreground capitalize">{mainMedia.processing_state}</p>
                </div>
              )}
              {mainMedia.media_group_id && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Media Group ID</p>
                  <p className="text-foreground">{mainMedia.media_group_id}</p>
                </div>
              )}
              {mainMedia.group_message_count && (
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Group Size</p>
                  <p className="text-foreground">{mainMedia.group_message_count}</p>
                </div>
              )}
            </div>

            {analyzedContent?.notes && (
              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground font-medium mb-1">Notes</p>
                <p className="text-foreground">{analyzedContent.notes}</p>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="bg-secondary hover:bg-secondary/80"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={onNext}
                disabled={!hasNext}
                className="bg-secondary hover:bg-secondary/80"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
