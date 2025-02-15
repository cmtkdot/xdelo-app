
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { MediaItem } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (media: MediaItem, deleteTelegram: boolean = true) => {
    try {
      setIsProcessing(true);
      
      if (deleteTelegram && media.telegram_message_id && media.chat_id) {
        const { error: telegramError } = await supabase.functions.invoke('delete-telegram-message', {
          body: {
            message_id: media.telegram_message_id,
            chat_id: media.chat_id,
            media_group_id: media.media_group_id
          }
        });

        if (telegramError) throw telegramError;
      }

      // If we're only deleting from database, we need to delete the media file
      if (!deleteTelegram && media.file_unique_id) {
        const { error: storageError } = await supabase.storage
          .from('telegram-media')
          .remove([`${media.file_unique_id}.${media.mime_type?.split('/')[1] || 'jpg'}`]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('messages')
        .delete()
        .eq('id', media.id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: `Media deleted successfully${deleteTelegram ? ' from both Telegram and database' : ' from database'}`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['mediaGroups'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });

    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: `Failed to delete media: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (media: MediaItem, updatedCaption: string) => {
    try {
      setIsProcessing(true);
      
      // Update caption in Telegram if we have the necessary IDs
      if (media.telegram_message_id && media.chat_id) {
        const { error: telegramError } = await supabase.functions.invoke('update-telegram-caption', {
          body: {
            message_id: media.telegram_message_id,
            chat_id: media.chat_id,
            caption: updatedCaption
          }
        });

        if (telegramError) throw telegramError;
      }

      // Update in database
      const { error: dbError } = await supabase
        .from('messages')
        .update({ 
          caption: updatedCaption,
          processing_state: 'pending' // Trigger reanalysis
        })
        .eq('id', media.id);

      if (dbError) throw dbError;

      // Trigger reanalysis if we have a correlation ID
      const correlationId = crypto.randomUUID();
      const { error: reanalysisError } = await supabase.functions.invoke('parse-caption-with-ai', {
        body: {
          message_id: media.id,
          media_group_id: media.media_group_id,
          caption: updatedCaption,
          correlation_id: correlationId
        }
      });

      if (reanalysisError) throw reanalysisError;

      toast({
        title: "Success",
        description: "Media updated successfully and queued for reanalysis",
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['mediaGroups'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });

    } catch (error: any) {
      console.error('Update error:', error);
      toast({
        title: "Error",
        description: `Failed to update media: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    handleDelete,
    handleSave,
    isProcessing
  };
};
