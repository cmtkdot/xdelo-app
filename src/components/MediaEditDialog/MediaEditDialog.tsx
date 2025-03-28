
import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import { useMediaUtils } from '@/hooks/useMediaUtils';

interface MediaEditDialogProps {
  media: { id: string; caption?: string; media_group_id?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
  onSave?: (newCaption: string) => void;
  onSuccess?: () => void;
}

export function MediaEditDialog({ 
  media, 
  open, 
  onOpenChange, 
  onClose,
  onSave, 
  onSuccess 
}: MediaEditDialogProps) {
  const [newCaption, setNewCaption] = useState(media?.caption || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { toast } = useToast();
  const { syncMessageCaption } = useMediaUtils();

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen && onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (media) {
      setNewCaption(media.caption || "");
    }
  }, [media]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSyncStatus(null);
    
    try {
      if (!media) throw new Error("No media found");
      
      setSyncStatus('Updating and analyzing caption...');
      
      // Use the updated caption sync hook to handle the update and sync
      const result = await syncMessageCaption({ 
        messageId: media.id,
        caption: newCaption
      });
      
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to process caption update');
      }
      
      setSyncStatus('Caption updated and synced');
      
      // Call the onSave callback if provided
      onSave && onSave(newCaption);
      
      // Allow parent to refresh data after successful save
      setTimeout(() => {
        onSuccess && onSuccess();
      }, 1500); // Small delay to ensure sync completes
      
    } catch (err: any) {
      console.error('Error updating caption:', err);
      setError(err.message || 'Error updating caption');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewCaption(e.target.value);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Media Caption</AlertDialogTitle>
          <AlertDialogDescription>
            Update the caption for this media item.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Caption
            </Label>
            <div className="col-span-3">
              <Textarea
                id="caption"
                value={newCaption}
                onChange={handleChange}
                className="col-span-3"
              />
            </div>
          </div>
          {syncStatus && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Sync Status
              </Label>
              <div className="col-span-3">
                <p className="text-sm text-muted-foreground">{syncStatus}</p>
              </div>
            </div>
          )}
          {error && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Error
              </Label>
              <div className="col-span-3">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          <Button type="submit" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
