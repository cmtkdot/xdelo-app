
import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { Card, CardContent } from '@/components/ui/card';
import { MessageHeader } from './MessageHeader';
import { MessageControlPanel } from './MessageControlPanel';
import { MessagesFilter, MessageFilterValues } from './MessagesFilter';
import useRealTimeMessages, { ProcessingStateType } from '@/hooks/useRealTimeMessages';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { useToast } from '@/hooks/useToast';
import { useMediaFixer } from '@/hooks/useMediaFixer';

export const MessageListContainer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<MessageFilterValues>({
    processingState: undefined,
    sortBy: 'updated_at',
    sortOrder: 'desc',
    showForwarded: false,
    showEdited: false
  });
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();
  const { fixMediaContentType } = useMediaFixer();
  
  const { 
    messages,
    isLoading,
    isRefreshing,
    lastRefresh,
    handleRefresh
  } = useRealTimeMessages({ 
    filter: searchTerm,
    processingState: filters.processingState as ProcessingStateType[] | undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    showForwarded: filters.showForwarded,
    showEdited: filters.showEdited
  });
  
  const { 
    processMessageById,
    isProcessing 
  } = useMessageQueue();
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (newFilters: MessageFilterValues) => {
    setFilters(newFilters);
  };

  const handleToggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleRetryProcessing = async (messageId: string) => {
    try {
      await processMessageById(messageId);
      handleRefresh();
      toast({
        title: "Processing started",
        description: "Message processing has been queued."
      });
    } catch (error: any) {
      console.error('Error retrying message processing:', error);
      toast({
        title: "Processing failed",
        description: error.message || "Failed to start message processing",
        variant: "destructive"
      });
    }
  };
  
  const handleFixMedia = async (messageId: string, storagePath: string) => {
    if (!storagePath) {
      toast({
        title: "Cannot fix media",
        description: "No storage path provided for this media",
        variant: "destructive"
      });
      return;
    }
    
    const success = await fixMediaContentType(storagePath);
    if (success) {
      handleRefresh();
    }
  };
  
  const isProcessingAny = isProcessing || isRefreshing;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <MessageHeader lastRefresh={lastRefresh} />
        <CardContent>
          <MessageControlPanel 
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            onToggleFilters={handleToggleFilters}
            showFilters={showFilters}
          />
          
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <MessagesFilter 
                filters={filters}
                onFilterChange={handleFilterChange}
              />
            </div>
          )}
        </CardContent>
      </Card>
      
      <MessageList 
        messages={messages}
        isLoading={isLoading}
        onRetryProcessing={handleRetryProcessing}
        onFixMedia={handleFixMedia}
        processAllLoading={isProcessingAny}
      />
    </div>
  );
};
