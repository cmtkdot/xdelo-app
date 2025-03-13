
import React from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useMediaOperations } from '@/hooks/useMediaOperations';
import { Message } from '@/types/MessagesTypes';

interface ContentDispositionFixButtonProps {
  message: Message;
  className?: string;
}

export function ContentDispositionFixButton({ message, className }: ContentDispositionFixButtonProps) {
  const { fixContentDispositionForMessage, processingMessageIds } = useMediaOperations();
  const isLoading = processingMessageIds[message.id];

  const handleFix = async () => {
    await fixContentDispositionForMessage(message.id);
  };

  // Only show button for media files without verified MIME type
  if (message.mime_type_verified) {
    return null;
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className={className}
      onClick={handleFix}
      disabled={isLoading}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      Fix Display
    </Button>
  );
}
