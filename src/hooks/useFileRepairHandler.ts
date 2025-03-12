
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export type RepairType = 'mime_type' | 'storage_path' | 'redownload';

export function useFileRepairHandler() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  const repairFile = async (messageId: string, repairType: RepairType) => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
        body: {
          messageId,
          repairType,
          correlationId: crypto.randomUUID()
        }
      });
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'File repair failed');
      }
      
      let successMessage = '';
      
      switch (repairType) {
        case 'mime_type':
          successMessage = data.unchanged 
            ? `MIME type verified (${data.mime_type})` 
            : `MIME type updated from ${data.original} to ${data.updated}`;
          break;
        case 'storage_path':
          successMessage = data.unchanged 
            ? `Storage path verified (${data.storage_path})` 
            : `Storage path updated from ${data.original} to ${data.updated}`;
          if (data.needs_redownload) {
            successMessage += '. File needs to be redownloaded.';
          }
          break;
        case 'redownload':
          successMessage = `File successfully redownloaded to ${data.storagePath}`;
          break;
        default:
          successMessage = `File repair (${repairType}) completed successfully`;
      }
      
      toast({
        title: "File Repair Successful",
        description: successMessage
      });
      
      return data;
    } catch (error) {
      console.error(`Error repairing file (${repairType}):`, error);
      
      toast({
        title: "File Repair Failed",
        description: error.message || `Failed to repair file (${repairType})`,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };
  
  const repairMimeType = (messageId: string) => repairFile(messageId, 'mime_type');
  const repairStoragePath = (messageId: string) => repairFile(messageId, 'storage_path');
  const redownloadFile = (messageId: string) => repairFile(messageId, 'redownload');

  return {
    repairFile,
    repairMimeType,
    repairStoragePath,
    redownloadFile,
    isRepairing
  };
}
