import { type ReactNode } from "react";
import { type Message } from "@/types/Message";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Hash, Package, Calendar } from "lucide-react";

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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Media Viewer</DialogTitle>
        </DialogHeader>
        <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
          <img
            src={media.public_url}
            alt={media.caption || "Media"}
            className="object-contain w-full h-full"
          />
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
