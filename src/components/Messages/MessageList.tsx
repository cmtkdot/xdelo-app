
import React from 'react';
import { Message } from '@/types';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, AlertCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onRetryProcessing: (messageId: string) => Promise<void>;
  onProcessAll: () => Promise<void>;
  processAllLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onRetryProcessing,
  onProcessAll,
  processAllLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-semibold mb-2">No messages found</h3>
        <p className="text-gray-500">There are no messages to display.</p>
      </div>
    );
  }

  // Count messages by processing state
  const pendingCount = messages.filter(msg => msg.processing_state === 'pending').length;
  const processingCount = messages.filter(msg => msg.processing_state === 'processing').length;
  const errorCount = messages.filter(msg => msg.processing_state === 'error').length;
  const completedCount = messages.filter(msg => msg.processing_state === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Message Processing Status</h2>
          <Button 
            onClick={onProcessAll} 
            disabled={processAllLoading || (!pendingCount && !errorCount)} 
            className="flex items-center"
          >
            {processAllLoading ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Process All
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCard title="Pending" count={pendingCount} icon={<Clock className="w-5 h-5 text-yellow-500" />} />
          <StatusCard title="Processing" count={processingCount} icon={<ArrowRight className="w-5 h-5 text-blue-500" />} />
          <StatusCard title="Completed" count={completedCount} icon={<CheckCircle className="w-5 h-5 text-green-500" />} />
          <StatusCard title="Error" count={errorCount} icon={<AlertCircle className="w-5 h-5 text-red-500" />} />
        </div>
      </div>

      <div className="space-y-4">
        {messages.map(message => (
          <MessageCard 
            key={message.id} 
            message={message} 
            onRetryProcessing={onRetryProcessing} 
          />
        ))}
      </div>
    </div>
  );
};

interface StatusCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, count, icon }) => (
  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
    <div className="flex justify-between items-center">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold">{count}</p>
      </div>
      <div className="text-2xl">{icon}</div>
    </div>
  </div>
);

interface MessageCardProps {
  message: Message;
  onRetryProcessing: (messageId: string) => Promise<void>;
}

const MessageCard: React.FC<MessageCardProps> = ({ message, onRetryProcessing }) => {
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

const StatusBadge = ({ status }: { status?: string }) => {
  switch (status) {
    case 'completed':
      return <Badge variant="success" className="text-xs">Completed</Badge>;
    case 'processing':
      return <Badge variant="default" className="text-xs">Processing</Badge>;
    case 'error':
      return <Badge variant="destructive" className="text-xs">Error</Badge>;
    case 'pending':
      return <Badge variant="warning" className="text-xs bg-yellow-500">Pending</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  }
};
