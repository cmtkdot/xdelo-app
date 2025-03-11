
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useProcessingSystem() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();
  
  /**
   * Get statistics about the message processing system
   */
  const getProcessingStats = async () => {
    try {
      const { data, error } = await supabase.rpc('xdelo_get_processing_system_stats');
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error getting processing system stats:', error);
      toast({
        title: "Error getting processing stats",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      throw error;
    }
  };
  
  /**
   * Repair the processing system (queue scheduler, etc.)
   */
  const repairProcessingSystem = async () => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.rpc('xdelo_repair_processing_system');
      
      if (error) throw error;
      
      toast({
        title: "System repaired",
        description: "The processing system has been successfully repaired",
      });
      
      return data;
    } catch (error) {
      console.error('Error repairing processing system:', error);
      toast({
        title: "Repair failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };
  
  /**
   * Repair stuck messages (messages stuck in processing state)
   */
  const repairStuckMessages = async () => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.rpc('xdelo_repair_stuck_messages');
      
      if (error) throw error;
      
      toast({
        title: "Messages repaired",
        description: `Successfully repaired ${data?.fixed_count || 0} stuck messages`,
      });
      
      return data;
    } catch (error) {
      console.error('Error repairing stuck messages:', error);
      toast({
        title: "Repair failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };
  
  return {
    getProcessingStats,
    repairProcessingSystem,
    repairStuckMessages,
    isRepairing
  };
}
