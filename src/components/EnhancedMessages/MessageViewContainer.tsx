
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
  handleViewMessage: (messages: Message[]) => void;  // Consistently accept array
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

  // No items to display
  if (!paginatedItems || paginatedItems.length === 0) {
    return (
      <div className="mt-6 p-8 text-center border rounded-md bg-muted/20">
        <h3 className="text-xl font-semibold mb-2">No messages found</h3>
        <p className="text-muted-foreground">Try adjusting your filters or refreshing the data.</p>
      </div>
    );
  }

  // Determine if we're dealing with grouped data
  const isGroupedData = Array.isArray(paginatedItems[0]);

  if (showMode === 'grid') {
    // Ensure data is in grouped format for grid view
    const messageGroups = isGroupedData
      ? (paginatedItems as Message[][])
      : (paginatedItems as Message[]).map(message => [message]);
    
    return (
      <MessageGridView
        messageGroups={messageGroups}
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
    // For list view, flatten groups if needed
    const flatItems = isGroupedData 
      ? (paginatedItems as Message[][]).flat() 
      : (paginatedItems as Message[]);
    
    return (
      <MessageListView
        messages={flatItems}
        onSelect={handleToggleSelect}
        onView={handleViewMessage}  // Now consistently passing arrays
        onEdit={handleEditMessage}
        onDelete={(message) => handleDeleteMessage(message.id)}
        selectedId={Object.keys(selectedMessages)[0]}
      />
    );
  }
}
