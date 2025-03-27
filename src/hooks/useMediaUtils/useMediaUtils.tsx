
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { MediaProcessingState, MediaSyncOptions, RepairResult } from './types';
import { createMediaProcessingState, withRetry } from './utils';

export function useMediaUtils() {
  const [isLoading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Create the media processing state (manages which messages are currently processing)
  const [mediaProcessingState, mediaProcessingActions] = createMediaProcessingState();
  const { isProcessing, processingMessageIds } = mediaProcessingState;
  const { setIsProcessing, addProcessingMessageId, removeProcessingMessageId } = mediaProcessingActions;
  
  /**
   * Synchronize content across media group messages
   */
  const syncMediaGroup = async (
    sourceMessageId: string, 
    mediaGroupId: string, 
    options: MediaSyncOptions = {}
  ): Promise<boolean> => {
    try {
      setLoading(true);
      addProcessingMessageId(sourceMessageId);
      
      const correlationId = crypto.randomUUID();
      
      // Get the source message first
      const { data: message } = await supabase
        .from('messages')
        .select('*')
        .eq('id', sourceMessageId)
        .single();
      
      if (!message || !message.analyzed_content) {
        toast({
          title: 'Error',
          description: 'Source message has no analyzed content to sync',
          variant: 'destructive',
        });
        return false;
      }
      
      // Call the database function with retry logic
      const { data, error } = await withRetry(
        () => supabase.rpc(
          'xdelo_sync_media_group_content',
          {
            p_message_id: sourceMessageId,
            p_analyzed_content: message.analyzed_content,
            p_force_sync: options.forceSync !== false,
            p_sync_edit_history: !!options.syncEditHistory
          }
        ),
        {
          maxAttempts: 3,
          delay: 1000,
          retryableErrors: ['timeout', 'connection', 'network']
        }
      );
      
      if (error) {
        console.error('Error syncing media group:', error);
        toast({
          title: 'Sync Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Group Synced',
        description: `Synchronized content to ${data.updated_count || 0} messages`,
      });
      
      return true;
    } catch (err) {
      console.error('Error in syncMediaGroup:', err);
      toast({
        title: 'Sync Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
      removeProcessingMessageId(sourceMessageId);
    }
  };

  /**
   * Process a single message caption
   */
  const syncMessageCaption = async (messageId: string): Promise<boolean> => {
    try {
      setLoading(true);
      addProcessingMessageId(messageId);
      
      // Call edge function to process caption
      const { data, error } = await supabase.functions.invoke('manual-caption-parser', {
        body: { 
          messageId,
          correlationId: crypto.randomUUID()
        }
      });
      
      if (error) {
        console.error('Error processing caption:', error);
        toast({
          title: 'Processing Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      if (!data.success) {
        toast({
          title: 'Processing Failed',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Caption Processed',
        description: `Successfully processed message caption${data.has_media_group ? ' and synced media group' : ''}`,
      });
      
      return true;
    } catch (err) {
      console.error('Error in syncMessageCaption:', err);
      toast({
        title: 'Processing Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Fix content disposition for a message
   */
  const fixContentDispositionForMessage = async (messageId: string): Promise<boolean> => {
    try {
      setLoading(true);
      addProcessingMessageId(messageId);
      
      // Call RPC to fix content disposition
      const { error } = await supabase.rpc(
        'xdelo_repair_file',
        {
          p_message_id: messageId,
          p_action: 'fix_mime_type'
        }
      );
      
      if (error) {
        console.error('Error fixing content disposition:', error);
        toast({
          title: 'Fix Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Fixed Content Disposition',
        description: 'Successfully updated content disposition',
      });
      
      return true;
    } catch (err) {
      console.error('Error in fixContentDisposition:', err);
      toast({
        title: 'Fix Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Re-upload media from Telegram
   */
  const reuploadMediaFromTelegram = async (messageId: string): Promise<boolean> => {
    try {
      setLoading(true);
      addProcessingMessageId(messageId);
      
      // Call edge function to handle reupload
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'reupload',
          messageId 
        }
      });
      
      if (error) {
        console.error('Error reuploading from Telegram:', error);
        toast({
          title: 'Reupload Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Media Reuploaded',
        description: data.message || 'Successfully reuploaded media from Telegram',
      });
      
      return true;
    } catch (err) {
      console.error('Error in reuploadMediaFromTelegram:', err);
      toast({
        title: 'Reupload Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Repair media in batch
   */
  const repairMediaBatch = async (messageIds: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      messageIds.forEach(id => addProcessingMessageId(id));
      
      // Call RPC to repair media
      const { data, error } = await supabase.rpc(
        'xdelo_repair_media_batch',
        {
          p_message_ids: messageIds
        }
      );
      
      if (error) {
        return {
          success: false,
          repaired: 0,
          error: error.message
        };
      }
      
      toast({
        title: 'Repair Complete',
        description: `Repaired ${data.repaired_count || 0} messages`,
      });
      
      return {
        success: true,
        repaired: data.repaired_count || 0,
        details: data.details || []
      };
    } catch (err) {
      console.error('Error in repairMediaBatch:', err);
      return {
        success: false,
        repaired: 0,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    } finally {
      setIsProcessing(false);
      messageIds.forEach(id => removeProcessingMessageId(id));
    }
  };

  /**
   * Standardize storage paths for messages
   */
  const standardizeStoragePaths = async (messageIds: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      messageIds.forEach(id => addProcessingMessageId(id));
      
      // Call RPC to standardize paths
      const { data, error } = await supabase.rpc(
        'xdelo_standardize_storage_paths_batch',
        {
          p_message_ids: messageIds
        }
      );
      
      if (error) {
        return {
          success: false,
          repaired: 0,
          error: error.message
        };
      }
      
      toast({
        title: 'Standardization Complete',
        description: `Standardized ${data.updated_count || 0} paths`,
      });
      
      return {
        success: true,
        repaired: data.updated_count || 0,
        details: data.details || []
      };
    } catch (err) {
      console.error('Error in standardizeStoragePaths:', err);
      return {
        success: false,
        repaired: 0,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    } finally {
      setIsProcessing(false);
      messageIds.forEach(id => removeProcessingMessageId(id));
    }
  };

  /**
   * Fix broken media URLs
   */
  const fixMediaUrls = async (messageIds: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      messageIds.forEach(id => addProcessingMessageId(id));
      
      // Call RPC to fix URLs
      const { data, error } = await supabase.rpc(
        'xdelo_fix_public_urls',
        {
          p_limit: messageIds.length || 100
        }
      );
      
      if (error) {
        return {
          success: false,
          repaired: 0,
          error: error.message
        };
      }
      
      toast({
        title: 'URL Fix Complete',
        description: `Fixed ${data?.length || 0} URLs`,
      });
      
      return {
        success: true,
        repaired: data?.length || 0,
        details: data || []
      };
    } catch (err) {
      console.error('Error in fixMediaUrls:', err);
      return {
        success: false,
        repaired: 0,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    } finally {
      setIsProcessing(false);
      messageIds.forEach(id => removeProcessingMessageId(id));
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
