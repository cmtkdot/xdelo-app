
import { useState } from 'react';
import { useToast } from './useToast';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for repairing stuck messages in the processing system
 */
export function useStuckMessageRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Repairs stuck messages by resetting their processing state
   */
  const repairStuckMessages = async () => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          operation: 'reset_stalled',
          trigger_source: 'manual_ui'
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Repair Completed",
        description: "Stuck messages were successfully reset"
      });
      
      return data;
    } catch (error: any) {
      console.error('Error repairing stuck messages:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair stuck messages",
        variant: "destructive"
      });
      
      return null;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    repairStuckMessages,
    isRepairing
  };
}
