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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/useToast"
import { supabase } from '@/integrations/supabase/client';

interface MediaEditDialogProps {
  media: { id: string; caption?: string; media_group_id?: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
  onSave?: (newCaption: string) => void;
  onDelete?: (mediaId: string, deleteTelegram: boolean) => Promise<void>;
  onSuccess?: () => void;
}

export function MediaEditDialog({ 
  media, 
  open, 
  onOpenChange, 
  onClose,
  onSave, 
  onDelete, 
  onSuccess 
}: MediaEditDialogProps) {
  const [newCaption, setNewCaption] = useState(media?.caption || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { toast } = useToast()

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
      
      const correlationId = crypto.randomUUID();
      
      console.log(`Updating media ${media.id} with new caption: "${newCaption}", correlation ID: ${correlationId}`);
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          caption: newCaption,
          updated_at: new Date().toISOString()
        })
        .eq('id', media.id);
      
      if (updateError) throw new Error(`Failed to update caption: ${updateError.message}`);
      
      setSyncStatus('Analyzing caption...');
      const { data: parsingData, error: parsingError } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: {
            messageId: media.id,
            caption: newCaption,
            media_group_id: media.media_group_id,
            correlationId,
            isEdit: true
          }
        }
      );
      
      if (parsingError) {
        throw new Error(`Failed to analyze caption: ${parsingError.message}`);
      }
      
      console.log('Caption parsed successfully:', parsingData);
      
      if (media.media_group_id) {
        setSyncStatus('Syncing with media group...');
        
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          'xdelo_sync_media_group',
          {
            body: {
              mediaGroupId: media.media_group_id,
              sourceMessageId: media.id,
              correlationId: correlationId,
              forceSync: true,
              syncEditHistory: true
            }
          }
        );
        
        if (syncError) {
          console.error('Media group sync error:', syncError);
          setSyncStatus('Media group sync failed!');
        } else {
          const updatedCount = syncResult?.data?.updated_count || 0;
          setSyncStatus(`Synced with ${updatedCount} other messages in group`);
          console.log(`Media group sync completed for ${media.media_group_id}:`, syncResult);
        }
      } else {
        setSyncStatus('Analysis completed');
      }
      
      onSave && onSave(newCaption);
      onSuccess && onSuccess();
      
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
          <AlertDialogCancel disabled={isSaving || isDeleting}>Cancel</AlertDialogCancel>
          <Button type="submit" onClick={handleSave} disabled={isSaving || isDeleting}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
