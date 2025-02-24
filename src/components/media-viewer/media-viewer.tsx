import { type Message } from "@/types/Message";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ImageSwiper } from "@/components/ui/ImageSwiper";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/AlertDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: Message | null;
  onNext?: () => void;
  onPrevious?: () => void;
}

interface MediaItem {
  id: string;
  public_url: string;
  mime_type: string;
  created_at: string;
  analyzed_content: any;
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  caption: string;
}

interface ErrorDisplay {
  code: string;
  message: string;
}

export const MediaViewer = ({
  isOpen,
  onClose,
  media,
  onNext,
  onPrevious,
}: MediaViewerProps) => {
  const [error, setError] = useState<ErrorDisplay | null>(null);

  // Convert Message to MediaItem with null checks
  const mediaItems: MediaItem[] = media ? [{
    id: media.id,
    public_url: media.public_url || '',
    mime_type: media.mime_type || '',
    created_at: media.created_at,
    analyzed_content: media.analyzed_content || {},
    file_id: media.file_id || '',
    file_unique_id: media.file_unique_id || '',
    width: media.width || 0,
    height: media.height || 0,
    caption: media.caption || '',
  }] : [];

  const mainMedia = media;
  const analyzedContent = mainMedia?.analyzed_content;

  const handlePrevious = (e: any) => {
    e.preventDefault();
    if (onPrevious) onPrevious();
  };

  const handleNext = (e: any) => {
    e.preventDefault();
    if (onNext) onNext();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogTitle className="text-lg font-semibold leading-none tracking-tight">
          Media Viewer
        </DialogTitle>
        <div className="flex-1 overflow-y-auto">
          {/* Navigation Controls */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
              {onPrevious && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  className="rounded-full bg-background/80 backdrop-blur-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
              {onNext && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  className="rounded-full bg-background/80 backdrop-blur-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Image Display */}
            <div className="relative aspect-video bg-muted">
              {mediaItems.length > 0 && (
                <ImageSwiper
                  images={mediaItems.map((item) => ({
                    src: item.public_url,
                    alt: item.caption || 'Media item',
                  }))}
                />
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="p-6 space-y-4">
            {/* Product Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mainMedia?.purchase_order && (
                <div className="bg-secondary/10 rounded-lg p-4 flex items-center space-x-3 hover:bg-secondary/20 transition-colors">
                  <Hash className="w-5 h-5 text-primary" />
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
                    <p className="text-base font-medium">{analyzedContent.quantity}</p>
                  </div>
                </div>
              )}

              {mainMedia?.created_at && (
                <div className="bg-secondary/10 rounded-lg p-4 flex items-center space-x-3 hover:bg-secondary/20 transition-colors">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="text-base font-medium">
                      {format(new Date(mainMedia.created_at), 'PPP')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Caption */}
            {mainMedia?.caption && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Caption</p>
                <p className="text-base">{mainMedia.caption}</p>
              </div>
            )}

            {/* Analyzed Content */}
            {analyzedContent && Object.keys(analyzedContent).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Analysis Results</p>
                <div className="space-y-2">
                  {Object.entries(analyzedContent).map(([key, value]) => (
                    <div key={key} className="flex items-start space-x-2">
                      <span className="text-sm font-medium">{key}:</span>
                      <span className="text-sm text-muted-foreground">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {error && (
          <AlertDialog>
            <AlertDialogContent>
              <AlertDialogTitle>Error</AlertDialogTitle>
              <div className="mt-2 text-sm">{error.message}</div>
              {error.code && <div className="mt-2 text-sm">Code: {error.code}</div>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  );
};
