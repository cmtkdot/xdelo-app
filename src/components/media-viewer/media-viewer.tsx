
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Message } from "@/types";
import { format } from "date-fns";
import { useState } from "react";

interface MediaViewerProps {
  media: Message;
  onClose: () => void;
}

export function MediaViewer({ media, onClose }: MediaViewerProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <div className="p-4 flex-1 overflow-auto">
          {media.public_url && media.media_type === 'photo' && (
            <div className="relative w-full h-full">
              <img
                src={media.public_url}
                alt={media.caption || 'Media content'}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
        <div className="p-4 bg-muted/10 border-t">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              {media.gl_purchase_order?.code && (
                <span className="font-medium">
                  Order: {media.gl_purchase_order.code}
                </span>
              )}
            </p>
            <p className="text-sm">{media.caption}</p>
            <p className="text-xs text-muted-foreground">
              {media.created_at && format(new Date(media.created_at), 'PPP')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
