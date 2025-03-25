
import React from 'react';
import { Message } from '@/types';
import { MediaTable } from "@/components/MediaTable/MediaTable";

interface GalleryTableViewProps {
  messages: Message[];
  onMediaClick: (message: Message) => void;
  onDeleteMessage: (id: string) => Promise<void>;
}

export const GalleryTableView: React.FC<GalleryTableViewProps> = ({ 
  messages, 
  onMediaClick,
  onDeleteMessage
}) => {
  return (
    <div className="w-full">
      <MediaTable 
        data={messages} 
        onEdit={onMediaClick}
        onView={onMediaClick}
        onDelete={async (message) => {
          await onDeleteMessage(message.id);
        }}
      />
    </div>
  );
};
