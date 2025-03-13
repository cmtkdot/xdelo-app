
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message } from '@/types';

export function useMediaOperations() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Reupload media from Telegram with correct MIME type
  const reuploadMediaFromTelegram = async (messageId: string) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-media',
        {
          body: { 
            action: 'reupload_from_telegram',
            messageIds: [messageId],
            options: {
              forceRedownload: true,
              updateMimeType: true,
              fixContentDisposition: true
            }
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Media Reuploaded",
        description: `Successfully reuploaded media for message ${messageId.substring(0, 8)}.`
      });
      
      return data;
    } catch (error) {
      console.error('Error reuploading media from Telegram:', error);
      
      toast({
        title: "Reupload Failed",
        description: error.message || "Failed to reupload media",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Fix MIME types for a batch of messages
  const fixMimeTypes = async (messageIds: string[]) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-media',
        {
          body: { 
            action: 'fix_mime_types',
            messageIds,
            options: {
              updateDatabase: true,
              updateStorageMetadata: true
            }
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "MIME Types Fixed",
        description: `Fixed MIME types for ${data.updated || 0} messages.`
      });
      
      return data;
    } catch (error) {
      console.error('Error fixing MIME types:', error);
      
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix MIME types",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Fix content disposition for media files
  const fixContentDisposition = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: { 
          action: 'fix_content_disposition',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Fixed content disposition for ${data.data.successful} files. ${data.data.failed} failed.`
      });

      return data;
    } catch (error) {
      console.error('Error fixing content disposition:', error);
      toast({
        title: "Error",
        description: "Failed to fix content disposition",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Check and validate file exists in storage
  const validateFileExists = async (messageId: string) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-media',
        {
          body: { 
            action: 'validate_storage',
            messageIds: [messageId]
          }
        }
      );
      
      if (error) throw error;
      
      const exists = data.exists || false;
      
      toast({
        title: "Storage Validation",
        description: exists 
          ? "Media file exists in storage" 
          : "Media file not found in storage",
        variant: exists ? "default" : "destructive"
      });
      
      return exists;
    } catch (error) {
      console.error('Error validating file existence:', error);
      
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate storage",
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Repair storage paths for messages
  const repairStoragePaths = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: { 
          action: 'repair_storage_paths',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Repaired storage paths for ${data.data.repaired || 0} files`
      });

      return data;
    } catch (error) {
      console.error('Error repairing storage paths:', error);
      toast({
        title: "Error",
        description: "Failed to repair storage paths",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Recover file metadata for messages
  const recoverFileMetadata = async (messageIds: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: { 
          action: 'recover_metadata',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Recovered metadata for ${data.recovered} files`
      });

      return data;
    } catch (error) {
      console.error('Error recovering file metadata:', error);
      toast({
        title: "Error",
        description: "Failed to recover file metadata",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Redownload file from a media group
  const redownloadFromMediaGroup = async (messageId: string, mediaGroupId?: string) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('redownload-from-media-group', {
        body: { messageId, mediaGroupId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Media file redownloaded successfully"
      });

      return data;
    } catch (error) {
      console.error('Error redownloading file:', error);
      toast({
        title: "Error",
        description: "Failed to redownload media file",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Repair all issues at once
  const repairAllIssues = async (messageIds: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: { 
          action: 'repair_all',
          messageIds,
          options: {
            fixContentDisposition: true,
            fixMimeTypes: true,
            repairStoragePaths: true,
            recoverMetadata: true
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Repaired ${data.results.successful} of ${messageIds.length} messages`
      });

      return data;
    } catch (error) {
      console.error('Error repairing media issues:', error);
      toast({
        title: "Error",
        description: "Failed to repair media issues",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Standardize storage paths
  const standardizeStoragePaths = async (limit: number = 100) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'xdelo_standardize_storage_paths',
        {
          body: { 
            limit, 
            dryRun: false,
            updatePublicUrls: true
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Storage Paths Standardized",
        description: `Standardized ${data.stats.fixed} paths, ${data.stats.skipped} already correct, ${data.stats.needs_redownload} need redownload.`
      });
      
      return data;
    } catch (error) {
      console.error('Error standardizing storage paths:', error);
      
      toast({
        title: "Operation Failed",
        description: error.message || "Failed to standardize storage paths",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    // All operations
    reuploadMediaFromTelegram,
    fixMimeTypes,
    fixContentDisposition,
    validateFileExists,
    repairStoragePaths,
    recoverFileMetadata,
    redownloadFromMediaGroup,
    repairAllIssues,
    standardizeStoragePaths,
    isProcessing
  };
}
