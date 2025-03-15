
import React from 'react';
import { Message } from '@/types/entities/Message';
import { MessageList } from '@/components/MessageList';
import { MessageGrid } from '@/components/MessageGrid';
import { Button } from "@/components/ui/button";
import { Loader2 } from 'lucide-react';

interface MessageViewContainerProps {
  showMode: 'list' | 'grid';
  paginatedItems: Message[] | Message[][];
  isLoading: boolean;
  hasMoreItems: boolean;
  handleLoadMore: () => void;
  handleViewMessage: (messages: Message[]) => void;
  handleEditMessage: (message: Message) => void;
  handleDeleteMessage: (id: string) => void;
  handleToggleSelect: (message: Message, selected: boolean) => void;
  selectedMessages: Record<string, boolean>;
}

export const MessageViewContainer: React.FC<MessageViewContainerProps> = ({
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
}) => {
  const renderMessages = () => {
    if (showMode === 'grid') {
      return (
        <MessageGrid 
          mediaGroups={paginatedItems as Message[][]} 
          isLoading={isLoading} 
          onView={handleViewMessage}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
          onToggleSelect={(message, selected) => handleToggleSelect(message, selected)}
          selectedMessages={selectedMessages}
        />
      );
    }
    
    return (
      <MessageList 
        messages={paginatedItems as Message[]}
        isLoading={isLoading}
        onView={(message) => handleViewMessage([message])}
        onDelete={handleDeleteMessage}
        onEdit={handleEditMessage}
        onToggleSelect={(message, selected) => handleToggleSelect(message, selected)}
        selectedMessages={selectedMessages}
      />
    );
  };

  return (
    <>
      {renderMessages()}
      
      {hasMoreItems && (
        <Button variant="outline" className="w-full mt-4" onClick={handleLoadMore}>
          {isLoading ? (
            <>
              Loading more...
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            </>
          ) : (
            'Load More'
          )}
        </Button>
      )}
    </>
  );
};
