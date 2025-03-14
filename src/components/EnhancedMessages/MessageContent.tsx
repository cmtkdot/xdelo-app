
import React from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from 'lucide-react';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Message } from '@/types';
import { MessageGridView } from './MessageGridView';
import { MessageListView } from './MessageListView';
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { useFilteredMessages } from '@/hooks/useFilteredMessages';

interface MessageContentProps {
  onSelect: (message: Message) => void;
  onView: (messageGroup: Message[]) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}

export function MessageContent({ 
  onSelect, 
  onView,
  onEdit,
  onDelete
}: MessageContentProps) {
  const { filters, selectedMessage } = useMessagesStore();
  const { 
    paginatedMessages, 
    isLoading, 
    error, 
    refetch 
  } = useFilteredMessages();

  const handleDataRefresh = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-xl font-semibold mb-2">Error loading messages</h3>
        <p className="text-muted-foreground mb-4">{String(error)}</p>
        <Button onClick={handleDataRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Safely flatten the messages array with proper type assertions
  const messages = React.useMemo(() => {
    if (!paginatedMessages || !Array.isArray(paginatedMessages)) {
      return [] as Message[];
    }
    
    if (paginatedMessages.length === 0) {
      return [] as Message[];
    }
    
    // Check if it's a nested array (Message[][])
    if (paginatedMessages.length > 0 && Array.isArray(paginatedMessages[0])) {
      // First cast to unknown then to the correct type for safe conversion
      const flattenedMessages = (paginatedMessages as unknown as Message[][]).flatMap(group => {
        // Ensure each group is an array and not empty
        if (Array.isArray(group) && group.length > 0) {
          return group;
        }
        return [];
      });
      return flattenedMessages;
    }
    
    // It's already a flat array
    return paginatedMessages as unknown as Message[];
  }, [paginatedMessages]);

  if (!messages.length) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-xl font-semibold mb-2">No messages found</h3>
        <p className="text-muted-foreground">Try adjusting your filters or refreshing the data.</p>
      </div>
    );
  }

  return (
    <Tabs value={filters.view} className="w-full">
      <TabsContent value="grid" className="mt-0">
        <MessageGridView 
          messages={messages} 
          onSelect={onSelect}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          selectedId={selectedMessage?.id}
        />
      </TabsContent>
      <TabsContent value="list" className="mt-0">
        <MessageListView 
          messages={messages}
          onSelect={onSelect}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          selectedId={selectedMessage?.id}
        />
      </TabsContent>
    </Tabs>
  );
}
