
import React from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message } from '@/types';

interface ListItemActionsProps {
  message: Message;
  onView: () => void;
  onEdit?: ((message: Message) => void) | undefined;
  onDelete?: ((message: Message) => void) | undefined;
  isMobile: boolean;
}

export const ListItemActions: React.FC<ListItemActionsProps> = ({
  message,
  onView,
  onEdit,
  onDelete,
  isMobile
}) => {
  return (
    <div className="flex items-center gap-1 ml-auto">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onView();
        }}
        title="View"
      >
        <Eye className="h-4 w-4" />
      </Button>
      
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(message);
          }}
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(message);
          }}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
