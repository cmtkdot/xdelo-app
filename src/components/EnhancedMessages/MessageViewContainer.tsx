
import React from 'react';
import { Message } from '@/types';
import { MessageGridView } from './MessageGridView';
import { MessageListView } from './MessageListView';
import { Skeleton } from '@/components/ui/skeleton';

interface MessageViewContainerProps {
  showMode: 'list' | 'grid';
  paginatedItems: Message[] | Message[][];
  isLoading: boolean;
  hasMoreItems: boolean;
  handleLoadMore: () => void;
  handleViewMessage: (messages: Message[]) => void;
  handleEditMessage: (message: Message) => void;
  handleDeleteMessage: (messageId: string) => void;
  handleToggleSelect: (message: Message) => void;
  selectedMessages: Record<string, Message>;
}

export function MessageViewContainer({
  showMode,
  paginatedItems,
  isLoading,
  hasMoreItems,
  handleLoadMore,
  handleViewMessage,
  handleEditMessage,
  handleDeleteMessage,
  handleToggleSelect,
  selectedMessages
}: MessageViewContainerProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square rounded-md" />
        ))}
      </div>
    );
  }

  if (showMode === 'grid' && Array.isArray(paginatedItems[0])) {
    // Grid view with grouped messages
    return (
      <MessageGridView
        messageGroups={paginatedItems as Message[][]}
        onSelect={handleToggleSelect}
        onView={handleViewMessage}
        onEdit={handleEditMessage}
        onDelete={(message) => handleDeleteMessage(message.id)}
        selectedMessages={selectedMessages}
        hasMoreItems={hasMoreItems}
        onLoadMore={handleLoadMore}
      />
    );
  } else {
    // List view with flat messages or fallback for grid if groups aren't available
    const flatItems = Array.isArray(paginatedItems[0]) 
      ? (paginatedItems as Message[][]).flat() 
      : (paginatedItems as Message[]);
    
    return (
      <MessageListView
        messages={flatItems}
        onSelect={handleToggleSelect}
        onView={handleViewMessage}
        onEdit={handleEditMessage}
        onDelete={(message) => handleDeleteMessage(message.id)}
        selectedId={Object.keys(selectedMessages)[0]}
      />
    );
  }
}
