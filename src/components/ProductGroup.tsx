import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileEdit, Eye, Trash2 } from "lucide-react";
import { Message } from "@/types";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useTelegramOperations } from '@/hooks/useTelegramOperations';
import { getMainMediaFromGroup, isVideoMessage } from '@/utils/mediaUtils';
import { DeleteMessageDialog } from '@/components/shared/DeleteMessageDialog';

interface ProductGroupProps {
  group: Message[];
  onEdit: (media: Message) => void;
  onView?: () => void;
  onDelete: (media: Message, deleteTelegram: boolean) => Promise<void>;
  isDeleting?: boolean;
}

export const ProductGroup: React.FC<ProductGroupProps> = ({ 
  group, 
  onEdit, 
  onView, 
  onDelete,
  isDeleting
}) => {
  const mainMedia = getMainMediaFromGroup(group);
  const { isProcessing } = useTelegramOperations();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  if (!mainMedia) return null;

  // Use the enhanced isVideoMessage function instead of direct MIME type checks
  const isVideo = isVideoMessage(mainMedia);

  const productName = mainMedia.analyzed_content?.product_name || 'No product name';

  const handleDelete = async (deleteTelegram: boolean) => {
    if (!mainMedia) return;
    await onDelete(mainMedia, deleteTelegram);
    setIsDeleteDialogOpen(false);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  return (
    <Card>
      <CardContent className="p-2">
        <AspectRatio ratio={1 / 1}>
          {isVideo ? (
            <video 
              src={mainMedia.public_url} 
              className="w-full h-full object-cover rounded-md" 
              preload="metadata"
              onError={(e) => {
                const target = e.target as HTMLVideoElement;
                console.error("Video failed to load:", mainMedia.public_url);
              }}
            />
          ) : (
            <img
              src={mainMedia.public_url}
              alt={mainMedia.caption || productName}
              className="w-full h-full object-cover rounded-md"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder.svg';
                target.classList.add('bg-gray-200');
              }}
            />
          )}
        </AspectRatio>
        <p className="text-sm mt-2 truncate font-medium">
          {productName}
        </p>
        {mainMedia.caption && (
          <p className="text-xs text-gray-500 mt-1 truncate">
            {mainMedia.caption}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex justify-between items-center p-2">
        <div className="space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(mainMedia)}
            disabled={isProcessing}
          >
            <FileEdit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          {onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              disabled={isProcessing}
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          )}
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteClick}
          disabled={isDeleting || isProcessing}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </CardFooter>
      
      <DeleteMessageDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        messageToDelete={mainMedia}
        onConfirm={handleDelete}
        isProcessing={isDeleting || isProcessing}
      />
    </Card>
  );
};
