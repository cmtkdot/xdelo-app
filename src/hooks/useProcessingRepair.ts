
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logSyncOperation } from '@/lib/syncUtils';

/**
 * Hook for general processing system repair operations
 */
export function useProcessingRepair() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Run a repair operation with proper error handling and logging
   */
  const runRepairOperation = async (
    operationName: string,
    operation: () => Promise<any>,
    successMessage: string
  ) => {
    try {
      setIsRepairing(true);
      
      const result = await operation();
      
      toast({
        title: successMessage,
        description: `Operation completed successfully.`
      });
      
      // Log the successful repair operation
      await logSyncOperation(
        supabase as any,
        operationName,
        {
          result,
          timestamp: new Date().toISOString()
        },
        true
      );
      
      return { 
        success: true, 
        ...result
      };
      
    } catch (error: any) {
      console.error(`Error during ${operationName}:`, error);
      
      toast({
        title: "Repair Failed",
        description: error.message || `Failed to complete ${operationName}`,
        variant: "destructive"
      });
      
      // Log the failed repair attempt
      await logSyncOperation(
        supabase as any,
        operationName,
        {
          error: error.message,
          timestamp: new Date().toISOString()
        },
        false,
        error.message
      );
      
      throw error;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    runRepairOperation,
    isRepairing
  };
}
