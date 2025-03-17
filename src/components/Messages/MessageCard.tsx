
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { Message } from '@/types';
import { formatDate } from '@/lib/utils';
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MessageCardProps {
  message: Message;
  onRetryProcessing: (messageId: string) => Promise<void>;
}

export const MessageCard: React.FC<MessageCardProps> = ({ 
  message, 
  onRetryProcessing,
}) => {
  const { 
    processingMessageIds, 
    repairMediaBatch 
  } = useMediaUtils();
  
  const { 
    id,
    caption,
    analyzed_content,
    processing_state,
    created_at,
    error_message
  } = message;

  const handleRetry = async () => {
    if (processingMessageIds[id]) return;
    
    try {
      // Try the provided retry function first
      await onRetryProcessing(id);
    } catch (error) {
      console.error('Error in primary retry, attempting repair:', error);
      // Fall back to repair if the retry function fails
      await repairMediaBatch([id]);
    }
  };

  const isError = message.processing_state === 'error';
  const productDetails = analyzed_content ? (analyzed_content as any)?.product_name : null;
  const isProcessing = processingMessageIds[id];
  
  // Format error message to be more user-friendly
  const formattedError = error_message ? 
    error_message.replace(/(Error:|Exception:)/g, '').trim() : 
    'Unknown error occurred';

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            {productDetails && (
              <div className="text-sm font-medium">{productDetails}</div>
            )}
            {caption && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {caption.substring(0, 100)}{caption.length > 100 ? '...' : ''}
              </p>
            )}
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Created: {formatDate(new Date(created_at || ''))}
            </div>
            {error_message && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="text-xs text-red-500 dark:text-red-400 flex items-center space-x-1">
                      <AlertCircle className="h-3 w-3" />
                      <span>{formattedError.substring(0, 50)}{formattedError.length > 50 ? '...' : ''}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {error_message}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {isError && (
              <Button 
                onClick={handleRetry}
                disabled={isProcessing}
                variant="outline"
                size="sm"
                className="h-8 px-2"
              >
                {isProcessing ? (
                  <Spinner size="sm" className="mr-1" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1" />
                )}
                Retry
              </Button>
            )}
            <Badge variant={isError ? "destructive" : "secondary"}>{processing_state}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
