
import { useCallback } from 'react';
import { Message } from '@/types/entities/Message';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { RepairResult } from './types';
import { logEvent, LogEventType } from '@/lib/logUtils';

/**
 * Hook with single file media operations
 */
export function useSingleFileOperations(
  addProcessingMessageId: (id: string) => void,
  removeProcessingMessageId: (id: string) => void
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Process a message to extract and analyze its content
   */
  const processMessage = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to process the message
      const { data, error } = await supabase.functions.invoke('process_message', {
        body: { messageId }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to process message');
      }
      
      if (data?.success) {
        toast({
          title: "Message Processed",
          description: data.message || "Message has been processed successfully."
        });
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        
        return {
          success: true,
          message: data.message,
          data
        };
      } else {
        throw new Error(data?.message || 'Processing failed');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process message",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Reupload media from Telegram for a specific message
   */
  const reuploadMediaFromTelegram = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to reupload media
      const { data, error } = await supabase.functions.invoke('reupload_media', {
        body: { messageId }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to reupload media');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: 'Media Reuploaded',
          description: 'File has been successfully reuploaded from Telegram.',
        });
        return data;
      } else {
        throw new Error(data?.message || 'Reupload failed');
      }
    } catch (error) {
      console.error('Error reuploading media:', error);
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to reupload media. Please try again.',
        variant: 'destructive',
      });
      
      return { 
        success: false, 
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Fix content disposition for a single message
   */
  const fixContentDispositionForMessage = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to fix content disposition
      const { data, error } = await supabase.functions.invoke('fix_content_disposition', {
        body: { messageId }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to fix content disposition');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: 'Content Disposition Fixed',
          description: 'File metadata has been updated successfully.',
        });
        return data;
      } else {
        throw new Error(data?.message || 'Failed to fix content disposition');
      }
    } catch (error) {
      console.error('Error fixing content disposition:', error);
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to fix content disposition. Please try again.',
        variant: 'destructive',
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Reanalyze a message caption
   */
  const reanalyzeMessageCaption = useCallback(async (message: Message): Promise<RepairResult> => {
    try {
      addProcessingMessageId(message.id);
      
      // Call the edge function to reanalyze caption
      const { data, error } = await supabase.functions.invoke('analyze_caption', {
        body: { 
          messageId: message.id,
          caption: message.caption
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to analyze caption');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: "Analysis Complete",
          description: data.message || "The message has been analyzed successfully."
        });
        return data;
      } else {
        throw new Error(data?.message || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing caption:', error);
      
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze message",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(message.id);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Sync caption across all messages in a media group
   */
  const syncMessageCaption = useCallback(async ({ messageId }: { messageId: string }): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Get the message first
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (messageError || !message) {
        throw new Error(`Could not find message: ${messageError?.message || 'Not found'}`);
      }
      
      const mediaGroupId = message.media_group_id;
      
      if (!mediaGroupId) {
        return {
          success: false,
          message: "Message is not part of a media group"
        };
      }
      
      // Call the edge function to sync the media group
      const { data, error } = await supabase.functions.invoke('sync_media_group', {
        body: { 
          sourceMessageId: messageId,
          mediaGroupId: mediaGroupId,
          forceSync: true
        }
      });
      
      if (error) {
        throw new Error(`Failed to sync media group: ${error.message}`);
      }
      
      // Log the operation and refresh data
      await logEvent(
        LogEventType.SYNC_COMPLETED,
        messageId,
        {
          operation: 'caption_sync',
          media_group_id: mediaGroupId,
          result: data
        }
      );
      
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      
      toast({
        title: "Caption Synced",
        description: "Caption has been synced to all messages in the media group"
      });
      
      return {
        success: true,
        message: "Caption synced successfully",
        data
      };
      
    } catch (error) {
      console.error("Error syncing caption:", error);
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync caption to media group",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error during caption sync"
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  return {
    processMessage,
    reuploadMediaFromTelegram,
    fixContentDispositionForMessage,
    reanalyzeMessageCaption,
    syncMessageCaption
  };
}
