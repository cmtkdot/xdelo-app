
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logMessageOperation, LogEventType } from '@/lib/syncLogger';

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
      
      const operationId = `repair_${Date.now()}`;
      
      // Log start of repair
      await logMessageOperation(LogEventType.SYSTEM_REPAIR, operationId, {
        operation: operationName,
        status: 'started',
        timestamp: new Date().toISOString()
      });
      
      const result = await operation();
      
      // Log successful repair
      await logMessageOperation(LogEventType.SYSTEM_REPAIR, operationId, {
        operation: operationName,
        status: 'completed',
        result,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: successMessage,
        description: `Operation completed successfully.`
      });
      
      return { 
        success: true, 
        ...result
      };
      
    } catch (error: any) {
      console.error(`Error during ${operationName}:`, error);
      
      // Log failed repair
      await logMessageOperation(LogEventType.SYSTEM_REPAIR, `repair_${Date.now()}`, {
        operation: operationName,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Repair Failed",
        description: error.message || `Failed to complete ${operationName}`,
        variant: "destructive"
      });
      
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
