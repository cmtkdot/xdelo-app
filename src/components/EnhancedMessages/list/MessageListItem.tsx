
import React, { useState } from 'react';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { MediaThumbnail } from './MediaThumbnail';
import { MessageContent } from './MessageContent';
import { ListItemActions } from './ListItemActions';

interface MessageListItemProps {
  message: Message;
  onSelect: (message: Message) => void;
  onView: () => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  isSelected?: boolean;
  isMobile: boolean;
  hasError: boolean;
}

export const MessageListItem: React.FC<MessageListItemProps> = ({
  message,
  onSelect,
  onView,
  onEdit,
  onDelete,
  isSelected,
  isMobile,
  hasError
}) => {
  const [mediaError, setMediaError] = useState(hasError);
  
  const handleMediaError = () => {
    setMediaError(true);
  };
  
  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
        isSelected && "bg-muted/70"
      )}
      onClick={() => onSelect(message)}
    >
      <MediaThumbnail 
        message={message}
        hasError={mediaError}
        onView={onView}
      />
      
      <MessageContent message={message} />
      
      <ListItemActions 
        message={message}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        isMobile={isMobile}
      />
    </div>
  );
};
