import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Message } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

interface MediaEditDialogProps {
  media: Message;
  open: boolean;
  onClose: () => void;
}

export const MediaEditDialog: React.FC<MediaEditDialogProps> = ({
  media,
  open,
  onClose,
}) => {
  const { toast } = useToast();
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    if (media) {
      // Extract caption from telegram_data
      const telegramData = media.telegram_data as { message?: { caption?: string } } || {};
      setCaption(telegramData.message?.caption || '');
    }
  }, [media]);

  if (!media) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      // Only update if caption has changed
      const currentTelegramData = media.telegram_data as { message?: { caption?: string } } || {};
      const originalCaption = currentTelegramData.message?.caption || '';
      
      if (caption !== originalCaption) {
        console.log('Updating caption:', {
          old: originalCaption,
          new: caption,
          messageId: media.telegram_message_id
        });

        // Update caption in Telegram
        const { error: captionError } = await supabase.functions.invoke('update-telegram-caption', {
          body: {
            messageId: media.id,
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

        // First update the message in database
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            caption: caption,
            telegram_data: updatedTelegramData,
            updated_at: new Date().toISOString()
          })
          .eq('id', media.id);

        if (updateError) throw updateError;

        // Trigger reanalysis
        console.log('Triggering reanalysis for updated content');
        const { error: reanalysisError } = await supabase.functions.invoke('parse-caption-with-ai', {
          body: {
            message_id: media.id,
            media_group_id: media.media_group_id,
            caption: caption,
            correlation_id: crypto.randomUUID()
          }
        });

        if (reanalysisError) {
          console.error('Reanalysis error:', reanalysisError);
          toast({
            description: "Caption updated but content reanalysis failed. It will be retried automatically.",
            variant: "destructive"
          });
        }

        toast({
          description: "Caption has been updated and content analysis triggered",
          variant: "success"
        });

        onClose();
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error updating caption:', error);
      toast({
        description: "Failed to update caption. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Display analyzed content in read-only format
  const renderAnalyzedContent = () => {
    const content = media.analyzed_content || {};
    return (
      <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-md dark:bg-gray-900">
        <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">Analyzed Content (Read-only)</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
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
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogTitle>Edit Caption</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Enter caption"
              className="min-h-[100px] resize-y"
              disabled={isSubmitting}
            />
          </div>

          {renderAnalyzedContent()}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
          
          {/* Telegram Channel Information */}
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Telegram Info:
              {media.chat_id && (
                <span className="block">
                  Channel ID: {media.chat_id}
                </span>
              )}
              {media.chat_type && (
                <span className="block">
                  Type: {media.chat_type}
                </span>
              )}
              {media.message_url && (
                <a 
                  href={media.message_url} 
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
