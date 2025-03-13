
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EnhancedMessagesHeaderProps {
  title: string;
  totalMessages: number;
  onRefresh: () => void;
  isLoading: boolean;
}

export const EnhancedMessagesHeader: React.FC<EnhancedMessagesHeaderProps> = ({
  title,
  totalMessages,
  onRefresh,
  isLoading
}) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground">
            {totalMessages} message{totalMessages !== 1 ? 's' : ''}
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>View and manage all messages with enhanced filtering and analytics.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      <Button variant="outline" onClick={onRefresh} disabled={isLoading} className="gap-2">
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  );
};
