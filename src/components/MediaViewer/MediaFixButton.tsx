
import React from 'react';
import { Button } from '@/components/ui/button';
import { Wrench } from 'lucide-react';

interface MediaFixButtonProps {
  storagePath: string;
  onFix: () => Promise<void>;
  isRepairing?: boolean;
}

export const MediaFixButton: React.FC<MediaFixButtonProps> = ({ 
  storagePath, 
  onFix, 
  isRepairing = false 
}) => {
  if (!storagePath) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="bg-white/70 hover:bg-white dark:bg-black/70 dark:hover:bg-black rounded-full h-8 w-8 p-0"
      onClick={onFix}
      disabled={isRepairing}
      title="Fix media content type"
    >
      <Wrench className="h-4 w-4" />
    </Button>
  );
};
