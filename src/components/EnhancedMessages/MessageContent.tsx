
import React from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, FileX } from 'lucide-react';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Message } from '@/types';
import { MessageGridView } from './MessageGridView';
import { MessageListView } from './MessageListView';
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { useFilteredMessages } from '@/hooks/useFilteredMessages';

interface MessageContentProps {
  onSelect: (message: Message) => void;
  onView: (messages: Message[]) => void;  // Standardized to use array
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
    refetch,
    total
  } = useFilteredMessages();

  const handleDataRefresh = () => {
    if (refetch) refetch();
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

  // Extract messages from pagination groups safely
  const extractMessages = (messageGroups: Message[][]) => {
    if (!messageGroups || !Array.isArray(messageGroups) || messageGroups.length === 0) {
      return [];
    }
    
    return messageGroups.flatMap(group => 
      Array.isArray(group) ? group : []
    );
  };

  const messages = extractMessages(paginatedMessages);

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
          messageGroups={messages.map(msg => [msg])} // Convert each message to a group array
          onSelect={onSelect}
          onView={onView}  // Already accepts Message[]
          onEdit={onEdit}
          onDelete={onDelete}
          selectedMessages={{[selectedMessage?.id || '']: selectedMessage as Message}}
          hasMoreItems={false}
          onLoadMore={() => {}}
        />
      </TabsContent>
      <TabsContent value="list" className="mt-0">
        <MessageListView 
          messages={messages}
          onSelect={onSelect}
          onView={onView}  // Now consistently accepts Message[]
          onEdit={onEdit}
          onDelete={onDelete}
          selectedId={selectedMessage?.id}
        />
      </TabsContent>
    </Tabs>
  );
}
