
import React from 'react';
import { Button } from '@/components/ui/button';
import { Wrench } from 'lucide-react';

export interface MediaFixButtonProps {
  storagePath: string;
  onFix: () => Promise<void>;
  isRepairing?: boolean;
  messageId?: string;
  // Add support for multiple message IDs
  messageIds?: string[];
  onComplete?: () => void;
}

export const MediaFixButton: React.FC<MediaFixButtonProps> = ({ 
  storagePath, 
  onFix, 
  isRepairing = false,
  messageId,
  messageIds,
  onComplete
}) => {
  if (!storagePath) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="bg-white/70 hover:bg-white dark:bg-black/70 dark:hover:bg-black rounded-full h-8 w-8 p-0"
      onClick={async () => {
        await onFix();
        if (onComplete) onComplete();
      }}
      disabled={isRepairing}
      title="Fix media content type"
      data-message-id={messageId}
    >
      <Wrench className="h-4 w-4" />
    </Button>
  );
};
