
import { Message } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  media: Message | null;
}

export const MediaViewer = ({ isOpen, onClose, media }: MediaViewerProps) => {
  if (!media) return null;

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
        {media.caption && (
          <p className="text-sm text-muted-foreground mt-2">{media.caption}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
