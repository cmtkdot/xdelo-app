
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Message } from '@/types';
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { Loader2 } from 'lucide-react';

interface MediaEditDialogProps {
  media: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MediaEditDialog: React.FC<MediaEditDialogProps> = ({
  media,
  open,
  onOpenChange
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    fixMediaUrls,
    standardizeStoragePaths
  } = useMediaUtils();

  const handleFixContentDisposition = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fixContentDispositionForMessage(media.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="text-red-500 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Button 
            onClick={handleFixContentDisposition}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fixing content disposition...
              </>
            ) : (
              'Fix Content Disposition'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
