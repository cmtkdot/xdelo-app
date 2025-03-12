
import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { Card, CardContent } from '@/components/ui/card';
import { MessageHeader } from './MessageHeader';
import { MessageControlPanel } from './MessageControlPanel';
import { MessagesFilter, MessageFilterValues } from './MessagesFilter';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { useToast } from '@/hooks/useToast';
import { ProcessingState } from '@/types';

export const MessageListContainer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<MessageFilterValues>({
    processingState: [],
    sortBy: 'updated_at',
    sortOrder: 'desc',
    showForwarded: false,
    showEdited: false
  });
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();
  
  const { 
    messages,
    isLoading,
    isRefreshing,
    lastRefresh,
    handleRefresh
  } = useRealTimeMessages({ 
    filter: searchTerm,
    processingState: filters.processingState as ProcessingState[],
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    showForwarded: filters.showForwarded,
    showEdited: filters.showEdited
  });
  
  const { 
    processMessageById,
    xdelo_fixMediaMimeTypes,
    xdelo_repairStoragePaths,
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
      await handleRefresh();
    } catch (error) {
      console.error('Error retrying message processing:', error);
    }
  };

  const handleFixMimeTypes = async () => {
    try {
      await xdelo_fixMediaMimeTypes(50);
      await handleRefresh();
      toast({
        title: "MIME Type Fix",
        description: "MIME type fix operation completed successfully"
      });
    } catch (error) {
      console.error('Error fixing MIME types:', error);
    }
  };
  
  const handleRepairStoragePaths = async () => {
    try {
      await xdelo_repairStoragePaths(100);
      await handleRefresh();
      toast({
        title: "Storage Path Repair",
        description: "Storage path repair operation completed successfully"
      });
    } catch (error) {
      console.error('Error repairing storage paths:', error);
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
            onFixMimeTypes={handleFixMimeTypes}
            onRepairStoragePaths={handleRepairStoragePaths}
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
        processAllLoading={isProcessingAny}
      />
    </div>
  );
};
