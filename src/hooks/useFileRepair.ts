
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FileRepairOptions {
  action: 'fix_mime_types' | 'repair_storage_paths' | 'fix_invalid_file_ids' | 'repair_all';
  messageIds?: string[];
  limit?: number;
  options?: Record<string, any>;
}

export function xdelo_useFileRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const repairFiles = async ({ action, messageIds, limit = 50, options = {} }: FileRepairOptions) => {
    setIsRepairing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
        body: { action, messageIds, limit, options }
      });
      
      if (error) {
        throw new Error(`Error repairing files: ${error.message}`);
      }
      
      setLastResult(data);
      
      // Generate success message based on action
      let successMessage = '';
      
      switch (action) {
        case 'fix_mime_types':
          successMessage = `Fixed MIME types for ${data?.data?.updated || 0} messages`;
          break;
        case 'repair_storage_paths':
          successMessage = `Repaired storage paths for ${data?.data?.fixed || 0} messages`;
          break;
        case 'fix_invalid_file_ids':
          successMessage = `Fixed file IDs for ${data?.data?.succeeded || 0} messages`;
          break;
        case 'repair_all':
          successMessage = 'Completed comprehensive file repair';
          break;
      }
      
      toast.success(successMessage, {
        description: 'The operation completed successfully'
      });
      
      return data;
    } catch (error) {
      console.error(`Error in ${action}:`, error);
      
      toast.error('File repair failed', {
        description: error.message
      });
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  const fixMimeTypes = async (messageIds?: string[], limit?: number) => {
    return repairFiles({ 
      action: 'fix_mime_types', 
      messageIds, 
      limit 
    });
  };

  const repairStoragePaths = async (messageIds?: string[], limit?: number) => {
    return repairFiles({ 
      action: 'repair_storage_paths', 
      messageIds, 
      limit 
    });
  };

  const fixInvalidFileIds = async (messageIds?: string[], limit?: number, dryRun: boolean = false) => {
    return repairFiles({ 
      action: 'fix_invalid_file_ids', 
      messageIds, 
      limit,
      options: { dryRun } 
    });
  };

  const repairAll = async (messageIds?: string[], limit?: number) => {
    return repairFiles({ 
      action: 'repair_all', 
      messageIds, 
      limit 
    });
  };

  return {
    isRepairing,
    lastResult,
    fixMimeTypes,
    repairStoragePaths,
    fixInvalidFileIds,
    repairAll
  };
}

// For backward compatibility
export const useFileRepair = xdelo_useFileRepair;
