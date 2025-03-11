
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaReprocessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

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

  const fixMimeTypes = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: { 
          action: 'fix_mime_types',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Updated MIME types for ${data.fixed} files`
      });

      return data;
    } catch (error) {
      console.error('Error fixing MIME types:', error);
      toast({
        title: "Error",
        description: "Failed to fix MIME types",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

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

  // New consolidated repair method
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

  return {
    fixContentDisposition,
    fixMimeTypes,
    repairStoragePaths,
    recoverFileMetadata,
    redownloadFromMediaGroup,
    repairAllIssues,
    isProcessing
  };
}
