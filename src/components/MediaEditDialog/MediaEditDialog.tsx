import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { useToast } from "@/hooks/useToast";
import { Message } from "@/types/entities/Message";
import { useEffect, useState } from 'react';

interface MediaEditDialogProps {
  isOpen: boolean;
  media: Message; // Proper type instead of any
  onClose: () => void;
  onSave?: (newCaption: string) => void;
  refresh?: () => void;
}

export function MediaEditDialog({
  isOpen,
  media,
  onClose,
  onSave,
  refresh
}: MediaEditDialogProps) {
  const [newCaption, setNewCaption] = useState(media?.caption || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { syncMessageCaption } = useMediaUtils();
  const { toast } = useToast();

  useEffect(() => {
    if (media) {
      setNewCaption(media.caption || "");
    }
  }, [media]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (!media) throw new Error("No media found");

      // If caption is updated, sync it with Telegram using our new function
      if (media.caption !== newCaption) {
        const captionSyncResult = await syncMessageCaption(media.id, newCaption);

        if (!captionSyncResult) {
          toast({
            variant: 'destructive',
            title: 'Caption Update Failed',
            description: 'Failed to sync caption with Telegram',
          });
        } else {
          toast({
            title: 'Message Updated',
            description: 'Caption has been updated successfully',
          });

          // Fix the unused expression by using if statement
          if (onSave) {
            onSave(newCaption);
          }

          onClose();
          if (refresh) {
            refresh();
          }
        }
      } else {
        // If nothing changed, just close
        onClose();
      }
    } catch (error) {
      console.error('Error saving media:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
        </DialogHeader>

        {media && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <label htmlFor="caption" className="text-sm font-medium">
                Caption
              </label>
              <Textarea
                id="caption"
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                className="col-span-3"
                rows={5}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Spinner className="mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
