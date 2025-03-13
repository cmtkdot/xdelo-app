
import React from 'react';
import { Button } from "@/components/ui/button";
import { FileDown, RefreshCcw, FileEdit } from "lucide-react";
import { Message } from "@/types/MessagesTypes";
import { useMediaOperations } from '@/hooks/useMediaOperations';

interface MediaFixToolsProps {
  message: Message;
  onEdit?: () => void;
}

export function MediaFixTools({ message, onEdit }: MediaFixToolsProps) {
  const { reuploadMediaFromTelegram, processingMessageIds } = useMediaOperations();
  const isLoading = processingMessageIds[message.id];

  const handleReupload = async () => {
    await reuploadMediaFromTelegram(message.id);
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
