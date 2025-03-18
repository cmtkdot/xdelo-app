
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RepairResult, SyncCaptionResult, StandardizeResult } from "./types";

export const useSingleFileOperations = (
  addProcessingMessageId: (id: string) => void,
  removeProcessingMessageId: (id: string) => void
) => {
  /**
   * Reupload media from Telegram for a single message
   */
  const reuploadMediaFromTelegram = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_reupload_media', {
        body: { messageId }
      });
      
      if (error) throw error;
      
      toast.success('Media reuploaded successfully');
      
      return {
        success: true,
        message: 'Media reuploaded successfully',
        data
      };
    } catch (error) {
      console.error('Error reuploading media:', error);
      toast.error('Failed to reupload media');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Fix content disposition for a single message
   */
  const fixContentDispositionForMessage = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
        body: { messageId }
      });
      
      if (error) throw error;
      
      toast.success('Content disposition fixed successfully');
      
      return {
        success: true,
        message: 'Content disposition fixed successfully',
        data
      };
    } catch (error) {
      console.error('Error fixing content disposition:', error);
      toast.error('Failed to fix content disposition');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Process a single message
   */
  const processMessage = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_process_message', {
        body: { messageId }
      });
      
      if (error) throw error;
      
      toast.success('Message processed successfully');
      
      return {
        success: true,
        message: 'Message processed successfully',
        data
      };
    } catch (error) {
      console.error('Error processing message:', error);
      toast.error('Failed to process message');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Reanalyze message caption
   */
  const reanalyzeMessageCaption = async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_reanalyze_caption', {
        body: { messageId, force: true }
      });
      
      if (error) throw error;
      
      toast.success('Caption reanalyzed successfully');
      
      return {
        success: true,
        message: 'Caption reanalyzed successfully',
        data
      };
    } catch (error) {
      console.error('Error reanalyzing caption:', error);
      toast.error('Failed to reanalyze caption');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Sync message caption
   */
  const syncMessageCaption = async (messageId: string): Promise<SyncCaptionResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_sync_caption', {
        body: { messageId }
      });
      
      if (error) throw error;
      
      toast.success(`Caption synced successfully for ${data.synced} messages`);
      
      return {
        success: true,
        message: `Caption synced successfully for ${data.synced} messages`,
        synced: data.synced,
        skipped: data.skipped
      };
    } catch (error) {
      console.error('Error syncing caption:', error);
      toast.error('Failed to sync caption');
      return {
        success: false,
        message: 'Failed to sync caption',
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  /**
   * Standardize storage paths
   */
  const standardizeStoragePaths = async (messageId: string): Promise<StandardizeResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_path', {
        body: { messageId }
      });
      
      if (error) throw error;
      
      toast.success('Storage path standardized successfully');
      
      return {
        success: true,
        message: 'Storage path standardized successfully'
      };
    } catch (error) {
      console.error('Error standardizing storage path:', error);
      toast.error('Failed to standardize storage path');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

  return {
    reuploadMediaFromTelegram,
    fixContentDispositionForMessage,
    processMessage,
    reanalyzeMessageCaption,
    syncMessageCaption,
    standardizeStoragePaths
  };
};
