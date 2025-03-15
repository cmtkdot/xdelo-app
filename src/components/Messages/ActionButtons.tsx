
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Wrench } from 'lucide-react';
import { useMediaUtils } from '@/hooks/useMediaUtils';

interface ActionButtonsProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  isProcessing?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onRefresh,
  isRefreshing,
  isProcessing = false
}) => {
  const { isProcessing: isMediaProcessing, repairMediaBatch } = useMediaUtils();
  
  return (
    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
      <Button 
        variant="outline" 
        size="sm"
        onClick={onRefresh}
        disabled={isProcessing || isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => repairMediaBatch([])}
        disabled={isProcessing || isMediaProcessing}
      >
        <Wrench className="h-4 w-4 mr-1" />
        Repair Files
      </Button>
    </div>
  );
};
