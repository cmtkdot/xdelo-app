
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaReprocessing() {
  const [isProcessing, setIsProcessing] = useState(false);

  const fixContentDisposition = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { messageIds, fixContentDisposition: true }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fixing content disposition:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const fixMimeTypes = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { messageIds, fixMimeTypes: true }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fixing MIME types:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const repairStoragePaths = async (messageIds?: string[]) => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('repair-storage-paths', {
        body: { messageIds }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error repairing storage paths:', error);
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
          action: 'recover-metadata',
          messageIds 
        }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recovering file metadata:', error);
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
      return data;
    } catch (error) {
      console.error('Error redownloading file:', error);
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
