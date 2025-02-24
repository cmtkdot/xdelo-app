
import { Message } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductGroupProps {
  group: Message[];
  onEdit?: (media: Message) => void;
  onDelete?: (media: Message) => void;
  onView?: () => void;
}

export const ProductGroup = ({
  group,
  onEdit,
  onDelete,
  onView,
}: ProductGroupProps) => {
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Ensure group is always an array
  const safeGroup = Array.isArray(group) ? group : [];

  const handleMediaClick = (media: Message) => {
    setSelectedMedia(media);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setSelectedMedia(null);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Media Group</h3>
          <div className="flex space-x-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={onView}>
                View All
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {safeGroup.map((media) => (
            <Card
              key={media.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleMediaClick(media)}
            >
              <div className="aspect-video relative">
                {media.public_url && (
                  <img
                    src={media.public_url}
                    alt={media.caption || "Media"}
                    className="object-cover w-full h-full"
                  />
                )}
              </div>
              <div className="p-3 flex justify-between items-center">
                <p className="text-sm text-muted-foreground truncate">
                  {media.caption || "No caption"}
                </p>
                <div className="flex gap-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(media);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(media);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={isViewerOpen} onOpenChange={handleCloseViewer}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Media Viewer</DialogTitle>
          </DialogHeader>
          {selectedMedia && selectedMedia.public_url && (
            <div className="aspect-video relative bg-muted rounded-lg overflow-hidden">
              <img
                src={selectedMedia.public_url}
                alt={selectedMedia.caption || "Media"}
                className="object-contain w-full h-full"
              />
            </div>
          )}
          {selectedMedia?.caption && (
            <p className="text-sm text-muted-foreground mt-2">
              {selectedMedia.caption}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
