
import { useState } from 'react';
import { useSupabaseClient } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMessageQueue() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();
  const supabaseClient = useSupabaseClient();

  const processMessageQueue = async (count: number = 10) => {
    try {
      setIsProcessing(true);
      
      // Simplified direct processing approach
      const { data, error } = await supabaseClient.functions.invoke('direct-caption-processor', {
        body: { 
          count,
          auto_process: true 
        }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      toast({
        title: 'Processing complete',
        description: `Processed ${data.processed_count || 0} messages.`
      });
      
      return data;
    } catch (error) {
      toast({
        title: 'Processing failed',
        description: error.message,
        variant: 'destructive'
      });
      console.error('Processing error:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    results,
    processMessageQueue
  };
}
