
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Message } from '@/types/MessagesTypes';
import StatusBadge from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { MessageControlPanel } from './MessageControlPanel';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { MediaFixButton } from '@/components/MediaViewer/MediaFixButton';

interface MessageCardProps {
  message: Message;
  onRetryProcessing: (messageId: string) => Promise<void>;
  onFixMedia: (messageId: string, storagePath: string) => Promise<void>;
}

const MessageCard: React.FC<MessageCardProps> = ({ message, onRetryProcessing, onFixMedia }) => {
  // Format the creation date
  const formattedCreatedAt = message.created_at 
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : 'Unknown';

  const hasMedia = message.public_url && message.storage_path;
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-sm text-muted-foreground">
              Message ID: {message.telegram_message_id} • {formattedCreatedAt}
            </div>
            <StatusBadge status={message.processing_state} className="mt-1" />
          </div>
          
          {message.media_group_id && (
            <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded text-xs">
              Media Group: {message.media_group_id.substring(0, 8)}...
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        {hasMedia && (
          <div className="mb-4 relative rounded-md overflow-hidden">
            <MediaViewer 
              url={message.public_url} 
              mimeType={message.mime_type} 
              caption={message.caption}
              className="max-h-[300px] w-full object-contain"
            />
            
            <div className="absolute bottom-2 right-2">
              <MediaFixButton 
                storagePath={message.storage_path} 
                onFix={() => onFixMedia(message.id, message.storage_path)}
              />
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          {message.caption && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Caption:</h3>
              <p className="whitespace-pre-line">{message.caption}</p>
            </div>
          )}
          
          {message.analyzed_content && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Analyzed Content:</h3>
              <pre className="text-xs bg-muted p-2 rounded-md overflow-auto max-h-[200px]">
                {JSON.stringify(message.analyzed_content, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="bg-muted/30 flex justify-between items-center">
        <MessageControlPanel message={message} />
        
        {message.processing_state === 'error' && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => onRetryProcessing(message.id)}
          >
            Retry Processing
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default MessageCard;
