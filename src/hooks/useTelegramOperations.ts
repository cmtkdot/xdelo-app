
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import { Message } from "@/types";
import { logMessageOperation, logDeletion } from "@/lib/syncLogger";

export const useTelegramOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleMediaDownload = async (message: Message) => {
    if (!message.file_id) return null;
    
    try {
      const fileExtension = message.mime_type ? message.mime_type.split('/')[1] : 'jpeg';
      const storagePath = `${message.file_id}.${fileExtension}`;
      
      // Download the media from Telegram and store it
      const { data: downloadResponse, error: downloadError } = await supabase.functions.invoke(
        'download-telegram-media',
        {
          body: {
            file_id: message.file_id,
            storage_path: storagePath,
            mime_type: message.mime_type || 'image/jpeg'
          }
        }
      );

      if (downloadError) {
        throw downloadError;
      }

      return downloadResponse.publicUrl;
    } catch (error) {
      console.error('Media download error:', error);
      throw error;
    }
  };
  
  const handleDelete = async (message: Message, deleteTelegram: boolean = true) => {
    try {
      setIsProcessing(true);
      
      await logDeletion(message.id, deleteTelegram ? 'both' : 'database', {
        telegram_message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        media_group_id: message.media_group_id,
        operation: 'deletion_started'
      });
      
      // Check for forwards and media group
      const { data: relatedMessages, error: checkError } = await supabase
        .from('messages')
        .select('id, is_forward, original_message_id, media_group_id')
        .or(`original_message_id.eq.${message.id},media_group_id.eq.${message.media_group_id}`)
        .neq('id', message.id);

      if (checkError) throw checkError;

      const forwardedMessages = relatedMessages?.filter(m => m.is_forward && m.original_message_id === message.id) || [];
      const mediaGroupMessages = relatedMessages?.filter(m => m.media_group_id === message.media_group_id) || [];

      if (deleteTelegram && message.telegram_message_id && message.chat_id) {
        // First mark as being deleted from Telegram
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

        // Delete from Telegram with media group info
        const response = await supabase.functions.invoke('delete-telegram-message', {
          body: {
            message_id: message.telegram_message_id,
            chat_id: message.chat_id,
            media_group_id: message.media_group_id,
            is_media_group: mediaGroupMessages.length > 0
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
        
        await logDeletion(message.id, 'telegram', {
          telegram_message_id: message.telegram_message_id,
          chat_id: message.chat_id,
          media_group_id: message.media_group_id,
          operation: 'telegram_deletion_completed',
          related_messages: {
            forwards: forwardedMessages.length,
            media_group: mediaGroupMessages.length
          }
        });
      }

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
      
      await logDeletion(message.id, 'database', {
        operation: 'database_deletion_completed',
        had_forwards: forwardedMessages.length > 0,
        had_media_group: mediaGroupMessages.length > 0
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
      await logMessageOperation('update', message.id, {
        telegram_message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        old_caption: message.caption,
        new_caption: newCaption,
        operation: 'update_started'
      });
      
      // First, ensure media is downloaded and stored
      let publicUrl = message.public_url;
      if (message.file_id) {
        try {
          publicUrl = await handleMediaDownload(message);
        } catch (downloadError) {
          console.error('Failed to download media:', downloadError);
          // Continue with update even if download fails
        }
      }
      
      // Update caption in Telegram
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
      
      await logMessageOperation('update', message.id, {
        telegram_response: telegramResponse,
        operation: 'telegram_update_completed'
      });

      // Update database with new caption and public URL
      const { error: dbError } = await supabase
        .from('messages')
        .update({ 
          caption: newCaption,
          public_url: publicUrl,
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
      
      await logMessageOperation('update', message.id, {
        operation: 'database_update_completed',
        public_url: publicUrl
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
      }

      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      
      await logMessageOperation('update', message.id, {
        operation: 'update_completed'
      });

      toast({
        title: "Success",
        description: "Message updated successfully",
      });

    } catch (error) {
      console.error('Error updating caption:', error);
      toast({
        title: "Error",
        description: `Failed to update message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
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
