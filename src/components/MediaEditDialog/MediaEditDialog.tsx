
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
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  
  useEffect(() => {
    if (media) {
      const telegramData = media.telegram_data as { message?: { caption?: string } } || {};
      setCaption(telegramData.message?.caption || '');
      setSyncStatus(null);
    }
  }, [media]);

  if (!media) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      setSyncStatus('Updating caption...');
      
      const currentTelegramData = media.telegram_data as { message?: { caption?: string } } || {};
      const originalCaption = currentTelegramData.message?.caption || '';
      
      if (caption !== originalCaption) {
        console.log('Updating caption:', {
          old: originalCaption,
          new: caption,
          messageId: media.telegram_message_id,
          mediaGroupId: media.media_group_id
        });

        if (media.telegram_message_id) {
          setSyncStatus('Updating in Telegram...');
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
              console.warn('Telegram update error:', captionError);
              setSyncStatus('Telegram update failed, updating database...');
            }
          }
        }

        const updatedTelegramData = {
          ...currentTelegramData,
          message: {
            ...(currentTelegramData.message || {}),
            caption: caption
          }
        };

        setSyncStatus('Updating database...');
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            caption: caption,
            telegram_data: updatedTelegramData,
            updated_at: new Date().toISOString(),
            processing_state: 'pending',
            analyzed_content: null,
            is_original_caption: media.media_group_id ? true : null,
            group_caption_synced: false
          })
          .eq('id', media.id);

        if (updateError) {
          setSyncStatus('Database update failed!');
          throw updateError;
        }

        setSyncStatus('Analyzing content...');
        console.log('Triggering manual parser for updated content');
        const correlationId = crypto.randomUUID();
        
        // Use manual-caption-parser instead of parse-caption-with-ai
        const { data: parsingData, error: parsingError } = await supabase.functions.invoke('manual-caption-parser', {
          body: {
            messageId: media.id,
            caption: caption,
            media_group_id: media.media_group_id,
            correlationId: correlationId,
            isEdit: true,
            trigger_source: 'user_edit'
          }
        });

        if (parsingError) {
          console.error('Caption parsing error:', parsingError);
          setSyncStatus('Analysis failed, will retry automatically.');
          toast({
            description: "Caption updated but content analysis failed. It will be retried automatically.",
            variant: "destructive"
          });
        } else {
          console.log('Caption parsed successfully:', parsingData);
          
          if (media.media_group_id) {
            setSyncStatus('Syncing with media group...');
            
            // Explicitly trigger media group sync
            const { data: syncResult, error: syncError } = await supabase.functions.invoke('xdelo_sync_media_group', {
              body: {
                mediaGroupId: media.media_group_id,
                sourceMessageId: media.id,
                correlationId: correlationId,
                forceSync: true,
                syncEditHistory: true
              }
            });
            
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
        }

        toast({
          description: "Caption has been updated and content analysis triggered",
          variant: "success"
        });

        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error updating caption:', error);
      setSyncStatus('Error: Update failed');
      toast({
        description: "Failed to update caption. Please try again.",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  };

  const renderAnalyzedContent = () => {
    const content = media.analyzed_content || {};
    return (
      <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-md dark:bg-gray-900">
        <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">Analyzed Content (Read-only)</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {Object.entries(content).map(([key, value]) => (
            key !== 'parsing_metadata' && key !== 'sync_metadata' && (
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
          
          {syncStatus && (
            <div className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">
              {syncStatus}
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
          
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
          
          {media.media_group_id && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Media Group ID: {media.media_group_id}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
