
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "@/types";
import { logDeletion, logMessageOperation } from "@/lib/syncLogger";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleDelete = async (message: Message, deleteTelegram: boolean = true) => {
    try {
      setIsProcessing(true);
      
      // Log the start of the deletion process
      await logDeletion(message.id, deleteTelegram ? 'both' : 'database', {
        telegram_message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        media_group_id: message.media_group_id,
        operation: 'deletion_started'
      });
      
      if (deleteTelegram && message.telegram_message_id && message.chat_id) {
        // First mark the message as being deleted from Telegram
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            deleted_from_telegram: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);

        if (updateError) {
          await logDeletion(message.id, 'both', {
            error: updateError.message,
            stage: 'mark_as_deleted',
            operation: 'deletion_failed'
          });
          throw updateError;
        }

        // Then attempt to delete from Telegram
        const response = await supabase.functions.invoke('delete-telegram-message', {
          body: {
            message_id: message.telegram_message_id,
            chat_id: message.chat_id,
            media_group_id: message.media_group_id
          }
        });

        if (response.error) {
          await logDeletion(message.id, 'both', {
            error: response.error,
            stage: 'telegram_deletion',
            operation: 'deletion_failed'
          });
          throw response.error;
        }
        
        // Log successful Telegram deletion
        await logDeletion(message.id, 'telegram', {
          telegram_message_id: message.telegram_message_id,
          chat_id: message.chat_id,
          media_group_id: message.media_group_id,
          operation: 'telegram_deletion_completed'
        });
      }

      // Check for forwards before deletion
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('original_message_id', message.id)
        .eq('is_forward', true);

      // Delete from database
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', message.id);

      if (error) {
        await logDeletion(message.id, 'database', {
          error: error.message,
          stage: 'database_deletion',
          operation: 'deletion_failed'
        });
        throw error;
      }
      
      // Log successful database deletion
      await logDeletion(message.id, 'database', {
        operation: 'database_deletion_completed',
        had_forwards: count ? count > 0 : false
      });

      toast({
        title: "Success",
        description: `Message deleted successfully${deleteTelegram ? ' from both Telegram and database' : ' from database'}`,
      });

      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });

    } catch (error: unknown) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: `Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (message: Message, newCaption: string) => {
    setIsProcessing(true);
    try {
      // Log the start of the update process
      await logMessageOperation('update', message.id, {
        telegram_message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        old_caption: message.caption,
        new_caption: newCaption,
        operation: 'update_started'
      });
      
      // Update the caption in Telegram
      const { data: telegramResponse, error: telegramError } = await supabase
        .functions.invoke('update-telegram-caption', {
          body: {
            messageId: message.telegram_message_id,
            chatId: message.chat_id,
            caption: newCaption,
          },
        });

      if (telegramError) {
        await logMessageOperation('update', message.id, {
          error: telegramError,
          stage: 'telegram_update',
          operation: 'update_failed'
        });
        throw telegramError;
      }
      
      // Log successful Telegram update
      await logMessageOperation('update', message.id, {
        telegram_response: telegramResponse,
        operation: 'telegram_update_completed'
      });

      // Update the caption in the database
      const { error: dbError } = await supabase
        .from('messages')
        .update({ 
          caption: newCaption,
          updated_at: new Date().toISOString(),
          processing_state: 'pending'
        })
        .eq('id', message.id);

      if (dbError) {
        await logMessageOperation('update', message.id, {
          error: dbError.message,
          stage: 'database_update',
          operation: 'update_failed'
        });
        throw dbError;
      }
      
      // Log successful database update
      await logMessageOperation('update', message.id, {
        operation: 'database_update_completed'
      });

      // Send for AI analysis
      try {
        await logMessageOperation('analyze', message.id, {
          operation: 'analysis_started'
        });
        
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: message.id,
            caption: newCaption
          }
        });
        
        await logMessageOperation('analyze', message.id, {
          operation: 'analysis_requested'
        });
      } catch (analysisError) {
        await logMessageOperation('analyze', message.id, {
          error: analysisError instanceof Error ? analysisError.message : 'Unknown error',
          stage: 'request_analysis',
          operation: 'analysis_request_failed'
        });
        console.error('Error requesting analysis:', analysisError);
        // Don't throw here, we still want to consider the update successful
      }

      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      
      // Log overall success
      await logMessageOperation('update', message.id, {
        operation: 'update_completed'
      });

    } catch (error) {
      console.error('Error updating caption:', error);
      throw error;
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
