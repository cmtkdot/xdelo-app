
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { MediaProcessingState, MediaProcessingStateActions, RepairResult, MediaSyncOptions, CaptionFlowData } from './types';
import { createMediaProcessingState, withRetry } from './utils';

/**
 * Hook for media-related utility functions
 */
export function useMediaUtils() {
  const [isLoading, setIsLoading] = useState(false);
  const [mediaProcessingState, mediaProcessingActions] = createMediaProcessingState();
  const { isProcessing, processingMessageIds } = mediaProcessingState;
  const { setIsProcessing, addProcessingMessageId, removeProcessingMessageId } = mediaProcessingActions;
  
  const { toast } = useToast();

  /**
   * Synchronize captions across a media group
   */
  const syncMediaGroup = async (
    sourceMessageId: string,
    mediaGroupId: string,
    options: MediaSyncOptions = {}
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      addProcessingMessageId(sourceMessageId);
      
      const { forceSync = false, syncEditHistory = false } = options;
      
      // Call the database function to sync media group content
      const { data, error } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_message_id: sourceMessageId,
          p_analyzed_content: null, // Use the message's existing analyzed_content
          p_force_sync: forceSync,
          p_sync_edit_history: syncEditHistory
        }
      );
      
      if (error) {
        console.error('Error syncing media group:', error);
        toast({
          title: 'Sync Failed',
          description: `Failed to sync media group: ${error.message}`,
          variant: 'destructive'
        });
        return false;
      }
      
      toast({
        title: 'Media Group Synced',
        description: `Successfully synced ${data?.updated_count || 0} messages in the group`
      });
      
      return true;
    } catch (error) {
      console.error('Error in syncMediaGroup:', error);
      toast({
        title: 'Sync Failed',
        description: 'An unexpected error occurred during sync',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
      removeProcessingMessageId(sourceMessageId);
    }
  };

  /**
   * Update a message caption and trigger analysis
   */
  const syncMessageCaption = async (
    { messageId, caption }: { messageId: string; caption?: string }
  ): Promise<CaptionFlowData> => {
    try {
      setIsLoading(true);
      addProcessingMessageId(messageId);
      
      // Call the edge function to update the caption
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: {
          action: 'process_caption',
          messageId,
          caption,
          correlationId: crypto.randomUUID()
        }
      });
      
      if (error) {
        console.error('Error updating caption:', error);
        toast({
          title: 'Caption Update Failed',
          description: `Failed to update caption: ${error.message}`,
          variant: 'destructive'
        });
        return {
          success: false,
          message: error.message,
          message_id: messageId
        };
      }
      
      toast({
        title: 'Caption Updated',
        description: 'Successfully updated and processed the caption'
      });
      
      return {
        success: true,
        message: 'Caption updated and processed successfully',
        message_id: messageId,
        caption_updated: data.caption_updated,
        media_group_synced: data.media_group_synced
      };
    } catch (error: any) {
      console.error('Error in syncMessageCaption:', error);
      toast({
        title: 'Caption Update Failed',
        description: 'An unexpected error occurred during update',
        variant: 'destructive'
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        message_id: messageId
      };
    } finally {
      removeProcessingMessageId(messageId);
      setIsLoading(false);
    }
  };

  /**
   * Fix media file content disposition
   */
  const fixContentDispositionForMessage = async (messageId: string): Promise<boolean> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to fix content disposition
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: {
          action: 'fix_content_disposition',
          messageId
        }
      });
      
      if (error) {
        console.error('Error fixing content disposition:', error);
        toast({
          title: 'Fix Failed',
          description: `Failed to fix content disposition: ${error.message}`,
          variant: 'destructive'
        });
        return false;
      }
      
      toast({
        title: 'Content Disposition Fixed',
        description: 'Successfully fixed the file content disposition'
      });
      
      return true;
    } catch (error) {
      console.error('Error in fixContentDispositionForMessage:', error);
      toast({
        title: 'Fix Failed',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
      return false;
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Reupload media from Telegram
   */
  const reuploadMediaFromTelegram = async (messageId: string): Promise<boolean> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to reupload media
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: {
          action: 'reupload_media',
          messageId
        }
      });
      
      if (error) {
        console.error('Error reuploading media:', error);
        toast({
          title: 'Reupload Failed',
          description: `Failed to reupload media: ${error.message}`,
          variant: 'destructive'
        });
        return false;
      }
      
      toast({
        title: 'Media Reuploaded',
        description: 'Successfully reuploaded media from Telegram'
      });
      
      return true;
    } catch (error) {
      console.error('Error in reuploadMediaFromTelegram:', error);
      toast({
        title: 'Reupload Failed',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
      return false;
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Repair a batch of media files
   */
  const repairMediaBatch = async (messageIds?: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to repair media batch
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: {
          action: 'repair_media_batch',
          messageIds
        }
      });
      
      if (error) {
        console.error('Error repairing media batch:', error);
        toast({
          title: 'Repair Failed',
          description: `Failed to repair media: ${error.message}`,
          variant: 'destructive'
        });
        return {
          success: false,
          error: error.message,
          repaired: 0
        };
      }
      
      toast({
        title: 'Media Repaired',
        description: `Successfully repaired ${data?.repaired || 0} media files`
      });
      
      return {
        success: true,
        repaired: data?.repaired || 0,
        message: `Successfully repaired ${data?.repaired || 0} media files`,
        successful: data?.successful || 0,
        failed: data?.failed || 0
      };
    } catch (error: any) {
      console.error('Error in repairMediaBatch:', error);
      toast({
        title: 'Repair Failed',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
      return {
        success: false,
        error: error.message,
        repaired: 0
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Standardize storage paths for a batch of messages
   */
  const standardizeStoragePaths = async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to standardize storage paths
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: {
          action: 'standardize_paths',
          limit
        }
      });
      
      if (error) {
        console.error('Error standardizing storage paths:', error);
        toast({
          title: 'Standardization Failed',
          description: `Failed to standardize paths: ${error.message}`,
          variant: 'destructive'
        });
        return {
          success: false,
          error: error.message,
          repaired: 0
        };
      }
      
      toast({
        title: 'Paths Standardized',
        description: `Successfully standardized ${data?.repaired || 0} storage paths`
      });
      
      return {
        success: true,
        repaired: data?.repaired || 0,
        message: `Successfully standardized ${data?.repaired || 0} storage paths`,
        successful: data?.successful || 0,
        failed: data?.failed || 0
      };
    } catch (error: any) {
      console.error('Error in standardizeStoragePaths:', error);
      toast({
        title: 'Standardization Failed',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
      return {
        success: false,
        error: error.message,
        repaired: 0
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Fix URLs for media files
   */
  const fixMediaUrls = async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to fix media URLs
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: {
          action: 'fix_media_urls',
          limit
        }
      });
      
      if (error) {
        console.error('Error fixing media URLs:', error);
        toast({
          title: 'URL Fix Failed',
          description: `Failed to fix media URLs: ${error.message}`,
          variant: 'destructive'
        });
        return {
          success: false,
          error: error.message,
          repaired: 0
        };
      }
      
      toast({
        title: 'URLs Fixed',
        description: `Successfully fixed ${data?.repaired || 0} media URLs`
      });
      
      return {
        success: true,
        repaired: data?.repaired || 0,
        message: `Successfully fixed ${data?.repaired || 0} media URLs`,
        successful: data?.successful || 0,
        failed: data?.failed || 0
      };
    } catch (error: any) {
      console.error('Error in fixMediaUrls:', error);
      toast({
        title: 'URL Fix Failed',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
      return {
        success: false,
        error: error.message,
        repaired: 0
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    // Media group operations
    syncMediaGroup,
    syncMessageCaption,
    
    // Media repair operations
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    repairMediaBatch,
    standardizeStoragePaths,
    fixMediaUrls,
    
    // Loading states
    isLoading,
    isProcessing,
    processingMessageIds
  };
}
