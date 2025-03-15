
import React from 'react';
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Message } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ListItemActionsProps {
  message: Message;
  onView: () => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  isMobile: boolean;
}

export const ListItemActions: React.FC<ListItemActionsProps> = ({
  message,
  onView,
  onEdit,
  onDelete,
  isMobile
}) => {
  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4 mr-2" />
            View
          </DropdownMenuItem>
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(message)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem 
              onClick={() => onDelete(message)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onView();
        }}
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
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}
      
      {onDelete && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(message);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
