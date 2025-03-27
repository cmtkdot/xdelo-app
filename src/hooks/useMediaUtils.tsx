
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Message } from '@/types/MessagesTypes';

// Types
export interface MediaSyncOptions {
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

export interface RepairResult {
  success: boolean;
  repaired?: number;
  message?: string;
  error?: string;
  details?: any[];
  successful?: number;
  failed?: number;
}

export interface CaptionFlowData {
  success: boolean;
  message: string;
  message_id?: string;
  media_group_synced?: boolean;
  caption_updated?: boolean;
}

export function useMediaUtils() {
  const [isLoading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  
  // Helper function to manage processing state for individual messages
  const addProcessingMessageId = useCallback((messageId: string) => {
    setProcessingMessageIds(prev => ({ ...prev, [messageId]: true }));
  }, []);
  
  const removeProcessingMessageId = useCallback((messageId: string) => {
    setProcessingMessageIds(prev => {
      const newState = { ...prev };
      delete newState[messageId];
      return newState;
    });
  }, []);
  
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
      
      // Call the database function directly with RPC using the correct parameter signature
      const { data, error } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_message_id: sourceMessageId,
          p_analyzed_content: message.analyzed_content,
          p_force_sync: options.forceSync !== false,
          p_sync_edit_history: !!options.syncEditHistory
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
  const syncMessageCaption = async (
    { messageId, caption }: { messageId: string; caption?: string }
  ): Promise<CaptionFlowData> => {
    try {
      setLoading(true);
      addProcessingMessageId(messageId);
      
      const correlationId = crypto.randomUUID();
      
      // Call edge function to process caption
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: { 
          action: 'process_caption',
          messageId, 
          caption,
          correlationId
        }
      });
      
      if (error) {
        console.error('Error processing caption:', error);
        toast({
          title: 'Processing Failed',
          description: error.message,
          variant: 'destructive',
        });
        return {
          success: false,
          message: error.message
        };
      }
      
      if (!data.success) {
        toast({
          title: 'Processing Failed',
          description: data.message || 'Unknown error',
          variant: 'destructive',
        });
        return {
          success: false,
          message: data.message || 'Unknown error'
        };
      }
      
      toast({
        title: 'Caption Processed',
        description: `Successfully processed message caption${data.media_group_synced ? ' and synced media group' : ''}`,
      });
      
      return {
        success: true,
        message: 'Caption processed successfully',
        message_id: messageId,
        media_group_synced: data.media_group_synced,
        caption_updated: data.caption_updated
      };
    } catch (err) {
      console.error('Error in syncMessageCaption:', err);
      toast({
        title: 'Processing Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      };
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
      
      // Call edge function to fix content disposition
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
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: { 
          action: 'reupload_media',
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
  const repairMediaBatch = async (messageIds?: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      if (messageIds) {
        messageIds.forEach(id => addProcessingMessageId(id));
      }
      
      // Call edge function to repair media
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: { 
          action: 'repair_media_batch',
          messageIds
        }
      });
      
      if (error) {
        return {
          success: false,
          repaired: 0,
          error: error.message
        };
      }
      
      toast({
        title: 'Repair Complete',
        description: `Repaired ${data?.repaired || 0} messages`,
      });
      
      return {
        success: true,
        repaired: data?.repaired || 0,
        message: data?.message,
        details: data?.details || [],
        successful: data?.successful || 0,
        failed: data?.failed || 0
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
      if (messageIds) {
        messageIds.forEach(id => removeProcessingMessageId(id));
      }
    }
  };

  /**
   * Standardize storage paths for messages
   */
  const standardizeStoragePaths = async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Call edge function to standardize paths
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: { 
          action: 'standardize_paths',
          limit
        }
      });
      
      if (error) {
        return {
          success: false,
          repaired: 0,
          error: error.message
        };
      }
      
      toast({
        title: 'Standardization Complete',
        description: `Standardized ${data?.repaired || 0} paths`,
      });
      
      return {
        success: true,
        repaired: data?.repaired || 0,
        message: data?.message,
        details: data?.details || [],
        successful: data?.successful || 0,
        failed: data?.failed || 0
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
    }
  };

  /**
   * Fix broken media URLs
   */
  const fixMediaUrls = async (messageIds?: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      if (messageIds) {
        messageIds.forEach(id => addProcessingMessageId(id));
      }
      
      // Call edge function to fix URLs
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: { 
          action: 'fix_media_urls',
          messageIds
        }
      });
      
      if (error) {
        return {
          success: false,
          repaired: 0,
          error: error.message
        };
      }
      
      toast({
        title: 'URL Fix Complete',
        description: `Fixed ${data?.repaired || 0} URLs`,
      });
      
      return {
        success: true,
        repaired: data?.repaired || 0,
        message: data?.message,
        details: data?.details || [],
        successful: data?.successful || 0,
        failed: data?.failed || 0
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
      if (messageIds) {
        messageIds.forEach(id => removeProcessingMessageId(id));
      }
    }
  };
  
  // Now let's create a helper function for retrying operations
  const withRetry = async <T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts: number;
      delay: number;
      retryableErrors?: string[];
    }
  ): Promise<T> => {
    const { maxAttempts, delay, retryableErrors = [] } = options;
    let attempt = 0;
    let lastError: Error;
    
    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;
        
        // Check if we should retry based on the error message
        const shouldRetry = retryableErrors.length === 0 || 
          retryableErrors.some(errMsg => lastError.message.includes(errMsg));
        
        if (attempt >= maxAttempts || !shouldRetry) {
          throw lastError;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
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
    
    // Helper functions
    withRetry,
    
    // Loading states
    isLoading,
    isProcessing,
    processingMessageIds
  };
}
