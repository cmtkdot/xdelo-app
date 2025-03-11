
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, Filter } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Message } from '@/types/MessagesTypes';

interface MessageControlPanelProps {
  searchTerm?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onToggleFilters?: () => void;
  showFilters?: boolean;
  messageData?: Message;
  onRetry?: () => Promise<void>;
}

export function MessageControlPanel({
  searchTerm = '',
  onSearchChange = () => {},
  onRefresh = () => {},
  isRefreshing = false,
  onToggleFilters = () => {},
  showFilters = false,
  messageData,
  onRetry
}: MessageControlPanelProps) {
  return (
    <div className="flex items-center space-x-2">
      {searchTerm !== undefined && onSearchChange && (
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
      )}
      
      {onToggleFilters && (
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          onClick={onToggleFilters}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      )}
      
      {onRefresh && (
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
      )}
      
      {messageData && onRetry && messageData.processing_state === 'error' && (
        <Button 
          size="sm" 
          variant="outline" 
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}
