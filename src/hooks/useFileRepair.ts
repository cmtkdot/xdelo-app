
import { useState } from 'react';
import { useSupabase } from '@/integrations/supabase/SupabaseProvider';
import { useToast } from './useToast';

type RepairOperation = 'mime-types' | 'storage-paths' | 'file-ids' | 'all';

export function useFileRepair() {
  const { supabase } = useSupabase();
  const { toast } = useToast();
  const [isRepairing, setIsRepairing] = useState(false);

  const repairFiles = async (operation: RepairOperation) => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
        body: { operation }
      });

      if (error) throw error;

      const { success, message, stats } = data;
      
      if (success) {
        toast({
          title: 'File repair completed',
          description: `${message || 'Files were successfully repaired'} ${stats ? `(${stats.fixed} fixed, ${stats.skipped} skipped)` : ''}`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'File repair failed',
          description: message || 'There was an error repairing files',
          variant: 'destructive',
        });
      }
      
      return data;
    } catch (err) {
      console.error('Error repairing files:', err);
      toast({
        title: 'File repair error',
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairFiles,
    isRepairing
  };
}
