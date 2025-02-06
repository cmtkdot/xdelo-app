import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => void;
}

export const MediaEditDialog = ({
  editItem,
  onClose,
  onSave,
}: MediaEditDialogProps) => {
  const { toast } = useToast();
  const [caption, setCaption] = useState('');
  
  useEffect(() => {
    if (editItem) {
      // Extract caption from telegram_data
      const telegramData = editItem.telegram_data as { message?: { caption?: string } } || {};
      setCaption(telegramData.message?.caption || '');
    }
  }, [editItem]);

  if (!editItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Only update if caption has changed
      const currentTelegramData = editItem.telegram_data as { message?: { caption?: string } } || {};
      const originalCaption = currentTelegramData.message?.caption || '';
      
      if (caption !== originalCaption) {
        console.log('Updating caption:', {
          old: originalCaption,
          new: caption,
          messageId: editItem.telegram_message_id
        });

        // Update caption in Telegram
        const { error: captionError } = await supabase.functions.invoke('update-telegram-caption', {
          body: {
            messageId: editItem.id,
            newCaption: caption
          }
        });

        if (captionError) {
          if (captionError.message?.includes('message is not modified')) {
            console.log('Caption unchanged in Telegram, proceeding with other updates');
          } else {
            throw captionError;
          }
        }

        // Update telegram_data with new caption
        const updatedTelegramData = {
          ...currentTelegramData,
          message: {
            ...(currentTelegramData.message || {}),
            caption: caption
          }
        };

        // Update the message in database
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            caption: caption,
            telegram_data: updatedTelegramData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editItem.id);

        if (updateError) throw updateError;

        toast({
          title: "Success",
          description: "Caption has been updated",
        });

        onSave();
        onClose();
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error updating caption:', error);
      toast({
        title: "Error",
        description: "Failed to update caption. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Display analyzed content in read-only format
  const renderAnalyzedContent = () => {
    const content = editItem.analyzed_content || {};
    return (
      <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium text-sm text-gray-700">Analyzed Content (Read-only)</h3>
        <div className="space-y-2 text-sm text-gray-600">
          {Object.entries(content).map(([key, value]) => (
            key !== 'parsing_metadata' && (
              <div key={key} className="flex">
                <span className="font-medium w-32">{key.replace(/_/g, ' ')}:</span>
                <span>{String(value)}</span>
              </div>
            )
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={!!editItem} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogTitle>Edit Caption</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Enter caption"
              className="min-h-[100px] resize-y"
            />
          </div>

          {renderAnalyzedContent()}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
          
          {/* Telegram Channel Information */}
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-500">
              Telegram Info:
              {editItem.chat_id && (
                <span className="block">
                  Channel ID: {editItem.chat_id}
                </span>
              )}
              {editItem.chat_type && (
                <span className="block">
                  Type: {editItem.chat_type}
                </span>
              )}
              {editItem.message_url && (
                <a 
                  href={editItem.message_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-blue-500 hover:underline"
                >
                  View in Telegram
                </a>
              )}
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};