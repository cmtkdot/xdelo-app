
import { Message } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MediaViewer } from "@/components/media-viewer/media-viewer";
import { useState } from "react";

interface ProductGroupProps {
  groupId: string;
  messages: Message[];
  onEdit?: (media: Message) => void;
  onDelete?: (media: Message) => void;
  onView?: () => void;
}

export const ProductGroup = ({
  groupId,
  messages,
  onEdit,
  onDelete,
  onView,
}: ProductGroupProps) => {
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Ensure messages is always an array
  const safeMessages = Array.isArray(messages) ? messages : [];

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
          <h3 className="text-lg font-medium">Group: {groupId}</h3>
          <div className="flex space-x-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={onView}>
                View All
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {safeMessages.map((message) => (
            <Card
              key={message.id}
              className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleMediaClick(message)}
            >
              <div className="aspect-video relative">
                {message.public_url && (
                  <img
                    src={message.public_url}
                    alt={message.caption || "Media"}
                    className="object-cover w-full h-full"
                  />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm text-muted-foreground truncate">
                  {message.caption || "No caption"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <MediaViewer
        isOpen={isViewerOpen}
        onClose={handleCloseViewer}
        media={selectedMedia}
      />
    </Card>
  );
};
