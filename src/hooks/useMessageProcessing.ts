
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message } from '@/types';
import { useProcessingSystemRepair } from './useProcessingSystemRepair';

export function useMessageProcessing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { repairProcessingFlow } = useProcessingSystemRepair();

  const reprocessMessage = useCallback(async (messageId: string, force: boolean = false) => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_reprocess_message', {
        body: { 
          messageId,
          force
        }
      });
      
      if (error) {
        throw new Error(`Error reprocessing message: ${error.message}`);
      }
      
      toast({
        title: "Message reprocessing started",
        description: data.message || "Message has been queued for reprocessing",
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: "Reprocessing failed",
        description: error.message || "An error occurred during message reprocessing",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const batchReprocessMessages = useCallback(async (messages: Message[], force: boolean = false) => {
    setIsProcessing(true);
    
    try {
      const results = [];
      const errors = [];
      
      // Process in batches of 5 to avoid overwhelming the system
      for (let i = 0; i < messages.length; i += 5) {
        const batch = messages.slice(i, i + 5);
        
        const batchPromises = batch.map(message => 
          supabase.functions.invoke('xdelo_reprocess_message', {
            body: { 
              messageId: message.id,
              force
            }
          })
          .then(({ data, error }) => {
            if (error) throw new Error(`Error reprocessing message ${message.id}: ${error.message}`);
            return data;
          })
          .catch(error => {
            errors.push({ messageId: message.id, error: error.message });
            return null;
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(Boolean));
        
        // Add a small delay between batches
        if (i + 5 < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (errors.length > 0) {
        console.error('Errors during batch reprocessing:', errors);
        toast({
          title: "Partial reprocessing success",
          description: `Reprocessed ${results.length} messages, ${errors.length} failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Batch reprocessing started",
          description: `${results.length} messages have been queued for reprocessing`,
        });
      }
      
      return { results, errors };
    } catch (error: any) {
      toast({
        title: "Batch reprocessing failed",
        description: error.message || "An error occurred during batch reprocessing",
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  const repairProcessingSystem = useCallback(async () => {
    try {
      return await repairProcessingFlow();
    } catch (error: any) {
      toast({
        title: "System repair failed",
        description: error.message || "An error occurred during system repair",
        variant: "destructive",
      });
      
      throw error;
    }
  }, [repairProcessingFlow, toast]);

  return {
    reprocessMessage,
    batchReprocessMessages,
    repairProcessingSystem,
    isProcessing
  };
}
