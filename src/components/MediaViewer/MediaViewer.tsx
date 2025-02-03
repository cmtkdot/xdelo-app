import React from 'react';
import { MediaItem } from '@/types';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { format } from 'date-fns';

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  currentGroup: MediaItem[];
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
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
          <div className="absolute top-2 right-2 z-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full bg-background/80 backdrop-blur-sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 min-h-0">
            <ImageSwiper media={currentGroup} />
          </div>

          <div className="p-4 bg-background border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {analyzedContent?.product_name || 'Untitled Product'}
                </h3>
                <div className="space-y-1 text-sm">
                  <p>Code: {analyzedContent?.product_code || 'N/A'}</p>
                  <p>Vendor: {analyzedContent?.vendor_uid || 'N/A'}</p>
                  <p>Quantity: {analyzedContent?.quantity || 'N/A'}</p>
                  <p>Purchase Date: {formatDate(analyzedContent?.purchase_date)}</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Technical Details</h4>
                <div className="space-y-1 text-sm">
                  <p>Created: {formatDate(mainMedia.created_at)}</p>
                  <p>Updated: {formatDate(mainMedia.updated_at)}</p>
                  <p>Processing State: {mainMedia.processing_state}</p>
                  <p>Media Group ID: {mainMedia.media_group_id || 'N/A'}</p>
                  <p>Group Size: {mainMedia.group_message_count || 1}</p>
                </div>
              </div>
            </div>

            {analyzedContent?.notes && (
              <div className="mt-4">
                <h4 className="font-medium mb-1">Notes</h4>
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