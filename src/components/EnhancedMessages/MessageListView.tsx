
import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types';
import { useIsMobile } from '@/hooks/useMobile';
import { EmptyList } from './list/EmptyList';
import { MessageListItem } from './list/MessageListItem';

interface MessageListViewProps {
  messages: Message[];
  onSelect: (message: Message) => void;
  onView: (messages: Message[]) => void;  // Updated to accept array of messages
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
  const handleMediaError = useCallback((messageId: string) => {
    console.log(`Media load error for message: ${messageId}`);
    setMediaErrors(prev => ({ ...prev, [messageId]: true }));
  }, []);

  // Reset errors when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setMediaErrors({});
    }
  }, [messages]);

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
          onView={() => onView([message])}  // Wrap single message in array
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
