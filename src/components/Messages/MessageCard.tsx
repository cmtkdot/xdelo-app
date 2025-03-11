
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Message } from '@/types';
import { StatusBadge } from './StatusBadge';

interface MessageCardProps {
  message: Message;
  onRetryProcessing: (messageId: string) => Promise<void>;
}

export const MessageCard: React.FC<MessageCardProps> = ({ message, onRetryProcessing }) => {
  const isVideo = message.mime_type?.startsWith('video/');
  const isImage = message.mime_type?.startsWith('image/');
  const hasMediaGroup = !!message.media_group_id;
  const hasCaption = !!message.caption;
  const timeSinceCreation = message.created_at ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true }) : 'unknown time';
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-sm text-gray-500">
                  Message ID: {message.telegram_message_id}
                </p>
                <StatusBadge status={message.processing_state} />
                {hasMediaGroup && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs">Group</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Part of a media group: {message.media_group_id}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <p className="text-xs text-gray-400">{timeSinceCreation}</p>
              </div>
              
              <p className="text-sm">
                Chat: {message.chat_title || message.chat_id}
              </p>
              
              {hasCaption && (
                <p className="font-medium mt-2">
                  <span className="font-semibold text-xs text-gray-500 block">Caption:</span> 
                  {message.caption}
                </p>
              )}
              
              {message.analyzed_content && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="font-semibold text-xs text-gray-500 block mb-1">Analyzed Content:</span>
                  {message.analyzed_content.product_name && (
                    <p className="text-sm">
                      <span className="font-semibold">Product:</span> {message.analyzed_content.product_name}
                    </p>
                  )}
                  {message.analyzed_content.vendor_uid && (
                    <p className="text-sm">
                      <span className="font-semibold">Vendor:</span> {message.analyzed_content.vendor_uid}
                    </p>
                  )}
                  {message.analyzed_content.purchase_date && (
                    <p className="text-sm">
                      <span className="font-semibold">Date:</span> {message.analyzed_content.purchase_date}
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {(message.processing_state === 'error' || message.processing_state === 'pending') && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    toast.promise(onRetryProcessing(message.id), {
                      loading: 'Processing message...',
                      success: 'Message processed successfully',
                      error: 'Failed to process message'
                    });
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Analyze
                </Button>
              )}
              {message.message_url && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  asChild
                >
                  <a href={message.message_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View in Telegram
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {message.public_url && (
          <div className="h-48 bg-gray-100 dark:bg-gray-700">
            {isImage ? (
              <img 
                src={message.public_url} 
                alt="Message media" 
                className="h-full w-full object-contain" 
              />
            ) : isVideo ? (
              <video 
                src={message.public_url} 
                controls 
                className="h-full w-full object-contain" 
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Media not supported</p>
              </div>
            )}
          </div>
        )}
        
        {message.error_message && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm">
            <p><span className="font-semibold">Error:</span> {message.error_message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
