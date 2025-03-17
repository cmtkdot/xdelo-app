
import React from 'react';
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash2 } from 'lucide-react';
import { Message } from '@/types';

interface CardActionsProps {
  onView: () => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  message: Message;
}

export const CardActions: React.FC<CardActionsProps> = ({
  onView,
  onEdit,
  onDelete,
  message
}) => {
  return (
    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
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
          className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
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
          className="h-8 w-8 bg-white/10 hover:bg-red-500/70 text-white"
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
