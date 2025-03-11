
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, Play, List } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface MessageControlPanelProps {
  searchTerm: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefresh: () => void;
  onQueueUnprocessed: () => void;
  onProcessQueue: () => void;
  isProcessingAny: boolean;
  isRefreshing: boolean;
}

export function MessageControlPanel({
  searchTerm,
  onSearchChange,
  onRefresh,
  onQueueUnprocessed,
  onProcessQueue,
  isProcessingAny,
  isRefreshing
}: MessageControlPanelProps) {
  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search messages..."
            className="pl-8"
            value={searchTerm}
            onChange={onSearchChange}
          />
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onQueueUnprocessed}
          disabled={isProcessingAny}
          className="flex-1"
        >
          <List className="h-4 w-4 mr-2" />
          Find Unprocessed
        </Button>
        
        <Button
          variant="default"
          size="sm" 
          onClick={onProcessQueue}
          disabled={isProcessingAny}
          className="flex-1"
        >
          <Play className="h-4 w-4 mr-2" />
          Process Queue
        </Button>
      </div>
    </div>
  );
}
