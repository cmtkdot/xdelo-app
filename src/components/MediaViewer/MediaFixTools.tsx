
import React from 'react';
import { Button } from "@/components/ui/button";
import { FileDown, RefreshCcw, FileEdit, Copy } from "lucide-react";
import { Message } from "@/types/MessagesTypes";
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { useToast } from '@/hooks/useToast';

interface MediaFixToolsProps {
  message: Message;
  onEdit?: () => void;
}

export function MediaFixTools({ message, onEdit }: MediaFixToolsProps) {
  const { reuploadMediaFromTelegram, syncMessageCaption, processingMessageIds } = useMediaUtils();
  const { toast } = useToast();
  const isLoading = processingMessageIds[message.id];

  const handleReupload = async () => {
    await reuploadMediaFromTelegram(message.id);
  };

  const handleSyncCaption = async () => {
    if (!message.media_group_id) {
      toast({
        title: "Sync not possible",
        description: "This message is not part of a media group",
        variant: "destructive"
      });
      return;
    }
    
    const result = await syncMessageCaption(message.id);
    
    if (result.success) {
      toast({
        title: "Caption synced",
        description: `Successfully synced caption to ${result.synced || 0} messages in the group`,
      });
    } else {
      toast({
        title: "Sync failed",
        description: result.message || "Failed to sync caption",
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    if (message.public_url) {
      window.open(message.public_url, '_blank');
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        title="Download file"
      >
        <FileDown className="h-4 w-4 mr-2" />
        Download
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleReupload}
        disabled={isLoading}
        title="Reupload file from Telegram"
      >
        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        Reupload
      </Button>
      
      {message.media_group_id && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncCaption}
          disabled={isLoading}
          title="Sync caption to all images in group"
        >
          <Copy className="h-4 w-4 mr-2" />
          Sync Caption
        </Button>
      )}
      
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          title="Edit caption"
        >
          <FileEdit className="h-4 w-4 mr-2" />
          Edit Caption
        </Button>
      )}
    </div>
  );
}
