
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

const useMediaManagement = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const validateFilesAndRepair = async (options: { limit?: number } = {}) => {
    try {
      setIsValidating(true);
      
      // Call the media-management function to validate and repair files
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: {
          operation: 'validate_and_repair',
          limit: options.limit || 20
        }
      });
      
      if (error) throw error;
      
      setResults(data);
      
      toast({
        title: 'Storage Validation Complete',
        description: `Checked ${data.checked_count || 0} files, repaired ${data.repaired_count || 0} files.`
      });
      
      return data;
    } catch (err: any) {
      console.error('Error validating storage files:', err);
      
      toast({
        title: 'Validation Failed',
        description: err.message || 'Failed to validate storage files',
        variant: 'destructive'
      });
      
      throw err;
    } finally {
      setIsValidating(false);
    }
  };

  // Function to redownload a specific file that's missing
  const redownloadFile = async (messageId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('redownload-from-media-group', {
        body: { messageId }
      });
      
      if (error) throw error;
      
      toast({
        title: 'File Redownloaded',
        description: 'The file has been successfully redownloaded'
      });
      
      return data;
    } catch (err: any) {
      console.error('Error redownloading file:', err);
      
      toast({
        title: 'Redownload Failed',
        description: err.message || 'Failed to redownload the file',
        variant: 'destructive'
      });
      
      throw err;
    }
  };

  return {
    isValidating,
    results,
    validateFilesAndRepair,
    redownloadFile
  };
};

export default useMediaManagement;
