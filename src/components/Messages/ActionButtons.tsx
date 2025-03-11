
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

interface ActionButtonsProps {
  onRefresh: () => void;
  onQueueUnprocessed: () => Promise<void>;
  onProcessQueue: () => Promise<void>;
  isProcessingAny: boolean;
  isRefreshing: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onRefresh,
  onQueueUnprocessed,
  onProcessQueue,
  isProcessingAny,
  isRefreshing
}) => {
  return (
    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
      <Button 
        variant="outline" 
        size="sm"
        onClick={onRefresh}
        disabled={isProcessingAny}
      >
        <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      <Button 
        variant="secondary" 
        size="sm"
        onClick={onQueueUnprocessed}
        disabled={isProcessingAny}
      >
        {isProcessingAny && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Find Unprocessed
      </Button>
      <Button 
        variant="default" 
        size="sm"
        onClick={onProcessQueue}
        disabled={isProcessingAny}
      >
        {isProcessingAny && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Process Queue
      </Button>
    </div>
  );
};
