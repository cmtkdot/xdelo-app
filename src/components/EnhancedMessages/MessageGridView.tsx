
import React from 'react';
import { Message } from '@/types';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';
import { MessageCard } from './grid/MessageCard';
import { EmptyState } from './grid/EmptyState';

interface MessageGridViewProps {
  messages: Message[];
  onSelect: (message: Message) => void;
  onView: (messageGroup: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  selectedId?: string;
}

export function MessageGridView({ 
  messages, 
  onSelect, 
  onView,
  onEdit,
  onDelete,
  selectedId
}: MessageGridViewProps) {
  const isMobile = useIsMobile();

  if (!messages || messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className={cn(
      "grid gap-3",
      isMobile
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    )}>
      {messages.map((message) => (
        <MessageCard
          key={message.id}
          message={message}
          onSelect={onSelect}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          isSelected={selectedId === message.id}
        />
      ))}
    </div>
  );
}
