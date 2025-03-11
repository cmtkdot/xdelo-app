
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaReprocessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const fixContentDisposition = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'fix_content_disposition',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Fixed content disposition for ${data.successful} files. ${data.failed} failed.`
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
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'fix_missing_mime_types',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Updated MIME types for ${data.processed} files`
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
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { 
          action: 'repair',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Repaired storage paths for ${data.repaired || 0} files`
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
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'recover_file_metadata',
          messageIds 
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Recovered metadata for ${messageIds.length} files`
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

  return {
    fixContentDisposition,
    fixMimeTypes,
    repairStoragePaths,
    recoverFileMetadata,
    redownloadFromMediaGroup,
    isProcessing
  };
}
