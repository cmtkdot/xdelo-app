
import React from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useContentDisposition } from '@/hooks/useContentDisposition';
import { Message } from '@/types/MessagesTypes';

interface ContentDispositionFixButtonProps {
  message: Message;
  className?: string;
}

export function ContentDispositionFixButton({ message, className }: ContentDispositionFixButtonProps) {
  const { fixContentDisposition, isProcessing } = useContentDisposition();
  const isLoading = isProcessing[message.id];

  const handleFix = async () => {
    await fixContentDisposition(message);
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
