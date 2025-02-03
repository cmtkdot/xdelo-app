import React from 'react';
import { MediaItem } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from 'date-fns';

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
  hasPrevious,
  hasNext
}: MediaViewerProps) => {
  const mainMedia = currentGroup.find(media => media.is_original_caption) || currentGroup[0];
  const analyzedContent = mainMedia?.analyzed_content;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy HH:mm:ss');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] p-0">
        <div className="relative h-full flex flex-col">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="text-base">
              {analyzedContent?.product_name || 'Untitled Product'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0">
            <ImageSwiper media={currentGroup} />
          </div>

          <div className="p-4 bg-background border-t">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">PO #:</span> {analyzedContent?.product_code ? `PO#${analyzedContent.product_code}` : 'N/A'}</p>
              <p><span className="font-medium">Vendor:</span> {analyzedContent?.vendor_uid || 'N/A'}</p>
              <p><span className="font-medium">Quantity:</span> {analyzedContent?.quantity || 'N/A'}</p>
              <p><span className="font-medium">Purchase Date:</span> {formatDate(analyzedContent?.purchase_date)}</p>
              <p><span className="font-medium">Created:</span> {formatDate(mainMedia.created_at)}</p>
              <p><span className="font-medium">Updated:</span> {formatDate(mainMedia.updated_at)}</p>
              <p><span className="font-medium">Processing State:</span> {mainMedia.processing_state}</p>
              <p><span className="font-medium">Media Group ID:</span> {mainMedia.media_group_id || 'N/A'}</p>
              <p><span className="font-medium">Group Size:</span> {mainMedia.group_message_count || 1}</p>
            </div>

            {analyzedContent?.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">{analyzedContent.notes}</p>
              </div>
            )}

            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={!hasPrevious}
                className="w-[100px]"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={onNext}
                disabled={!hasNext}
                className="w-[100px]"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};