import React from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileEdit, Eye, Trash2 } from "lucide-react";
import { Message } from "@/types";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useTelegramOperations } from '@/hooks/useTelegramOperations';

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
  const mainMedia = group.find(m => m.caption) || group[0];
  const { isProcessing } = useTelegramOperations();

  const handleDelete = async (deleteTelegram: boolean) => {
    if (!mainMedia) return;
    await onDelete(mainMedia, deleteTelegram);
  };

  return (
    <Card>
      <CardContent className="p-2">
        <AspectRatio ratio={1 / 1}>
          {mainMedia.mime_type?.startsWith('video/') ? (
            <video src={mainMedia.public_url} className="w-full h-full object-cover rounded-md" />
          ) : (
            <img
              src={mainMedia.public_url}
              alt={mainMedia.caption || 'Media'}
              className="w-full h-full object-cover rounded-md"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder.svg';
                target.classList.add('bg-gray-200');
              }}
            />
          )}
        </AspectRatio>
        <p className="text-sm mt-2 truncate">{mainMedia.caption || 'No caption'}</p>
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
          onClick={() => handleDelete(false)}
          disabled={isDeleting || isProcessing}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
};
