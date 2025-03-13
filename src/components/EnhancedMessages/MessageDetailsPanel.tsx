
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/useToast';
import { Message } from '@/types';
import { formatDate } from '@/lib/utils';

interface MessageDetailsPanelProps {
  message: Message;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}

export function MessageDetailsPanel({
  message,
  onEdit,
  onDelete
}: MessageDetailsPanelProps) {
  const { toast } = useToast();

  // Safety check for empty message
  if (!message) {
    return (
      <Card className="h-full overflow-y-auto">
        <CardHeader>
          <CardTitle>Message Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No message selected</p>
        </CardContent>
      </Card>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(message.id);
    toast({ 
      title: "Success",
      description: "Message ID copied to clipboard"
    });
  };

  const handleCopyMessageUrl = () => {
    if (message.message_url) {
      navigator.clipboard.writeText(message.message_url);
      toast({ 
        title: "Success",
        description: "Message URL copied to clipboard"
      });
    }
  };

  const renderAnalyzedContent = () => {
    if (!message.analyzed_content) return null;
    
    return (
      <div className="space-y-2 mt-4">
        <h4 className="font-medium text-sm">Analyzed Content</h4>
        <div className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
          <pre>{JSON.stringify(message.analyzed_content, null, 2)}</pre>
        </div>
      </div>
    );
  };

  // Safely format the creation date
  let formattedDate = 'Unknown date';
  try {
    if (message.created_at) {
      formattedDate = formatDate(new Date(message.created_at));
    }
  } catch (e) {
    console.error('Error formatting date:', e);
  }

  return (
    <Card className="h-full overflow-y-auto">
      <CardHeader>
        <CardTitle>Message Details</CardTitle>
        <div className="flex space-x-2 mt-2">
          <Badge variant={message.processing_state === 'completed' ? 'success' : 
                          message.processing_state === 'error' ? 'destructive' : 
                          'secondary'}>
            {message.processing_state || 'unknown'}
          </Badge>
          {message.is_forward && (
            <Badge variant="outline">Forwarded</Badge>
          )}
          {message.media_group_id && (
            <Badge variant="outline">Group</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">
            {message.analyzed_content?.product_name || 'Untitled Product'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formattedDate}
          </p>
        </div>

        {message.caption && (
          <div>
            <h4 className="font-medium text-sm mb-1">Caption</h4>
            <p className="text-sm bg-muted p-2 rounded-md">{message.caption}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="font-medium">ID</span>
            <div className="flex items-center gap-1">
              <span className="text-xs truncate">{message.id}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopyId}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              </Button>
            </div>
          </div>
          
          <div>
            <span className="font-medium">Chat</span>
            <p>{message.chat_title || message.chat_id || 'Unknown'}</p>
          </div>
          
          {message.file_unique_id && (
            <div>
              <span className="font-medium">File ID</span>
              <p className="truncate">{message.file_unique_id}</p>
            </div>
          )}
          
          {message.media_group_id && (
            <div>
              <span className="font-medium">Media Group</span>
              <p className="truncate">{message.media_group_id}</p>
            </div>
          )}
          
          {message.mime_type && (
            <div>
              <span className="font-medium">MIME Type</span>
              <p>{message.mime_type}</p>
            </div>
          )}
          
          {message.message_url && (
            <div className="col-span-2">
              <span className="font-medium">Telegram URL</span>
              <div className="flex items-center gap-1">
                <a href={message.message_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 truncate hover:underline">
                  {message.message_url}
                </a>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopyMessageUrl}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                </Button>
              </div>
            </div>
          )}
        </div>

        {renderAnalyzedContent()}

        <div className="flex space-x-2 pt-4">
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(message)}>
              Edit
            </Button>
          )}
          
          {onDelete && (
            <Button variant="destructive" onClick={() => onDelete(message)}>
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
