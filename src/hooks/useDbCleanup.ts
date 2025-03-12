
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useDbCleanup() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const cleanupFunctions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_cleanup_db_functions');
      
      if (error) throw error;
      
      setResults(data);
      toast({
        title: 'Database cleanup completed',
        description: `${data.results.removed} functions removed, ${data.results.skipped} skipped`,
      });
      
      return data;
    } catch (error) {
      console.error('Database cleanup error:', error);
      toast({
        title: 'Database cleanup failed',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    results,
    cleanupFunctions
  };
}
