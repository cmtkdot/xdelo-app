
import React, { useState } from 'react';
import { Message } from '@/types';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';
import { MessageListItem } from './list/MessageListItem';
import { EmptyList } from './list/EmptyList';

interface MessageListViewProps {
  messages: Message[];
  onSelect: (message: Message) => void;
  onView: (messageGroup: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  selectedId?: string;
}

export function MessageListView({ 
  messages, 
  onSelect, 
  onView,
  onEdit,
  onDelete,
  selectedId
}: MessageListViewProps) {
  const isMobile = useIsMobile();
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({});
  
  // Handle media load error
  const handleMediaError = (messageId: string) => {
    console.log(`Media load error for message: ${messageId}`);
    setMediaErrors(prev => ({ ...prev, [messageId]: true }));
  };

  if (!messages || messages.length === 0) {
    return <EmptyList />;
  }

  return (
    <div className="border rounded-md divide-y overflow-hidden">
      {messages.map((message) => (
        <MessageListItem
          key={message.id}
          message={message}
          onSelect={onSelect}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          isSelected={selectedId === message.id}
          isMobile={isMobile}
          hasError={!!mediaErrors[message.id]}
        />
      ))}
    </div>
  );
}
