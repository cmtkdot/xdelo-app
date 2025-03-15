
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message } from '@/types/entities/Message';
import { logEvent, LogEventType } from '@/lib/logUtils';
import { RepairResult } from '@/lib/mediaOperations';

export function useMessageOperations() {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Process a batch of messages
  const processMessageBatch = useCallback(async (count: number = 10): Promise<RepairResult> => {
    try {
      setIsProcessing(prev => ({ ...prev, batch: true }));
      
      // Call the edge function to process messages
      const { data, error } = await supabase.functions.invoke('direct-caption-processor', {
        body: { 
          count,
          auto_process: true 
        }
      });

      if (error) throw error;
      
      toast({
        title: "Processing Complete",
        description: `Processed ${data.processed_count || 0} messages.`
      });
      
      return {
        success: true,
        successful: data.processed_count || 0,
        message: `Processing complete: Processed ${data.processed_count || 0} messages.`
      };
    } catch (error) {
      console.error('Processing error:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process messages",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error occurred"
      };
    } finally {
      setIsProcessing(prev => {
        const updated = { ...prev };
        delete updated.batch;
        return updated;
      });
    }
  }, [toast]);

  // Sync captions for a message or group
  const syncMessageCaption = useCallback(async ({ 
    messageId, 
    mediaGroupId 
  }: { 
    messageId?: string; 
    mediaGroupId?: string;
  }): Promise<RepairResult> => {
    try {
      if (!messageId && !mediaGroupId) {
        throw new Error('Either messageId or mediaGroupId is required');
      }
      
      const id = messageId || `group_${mediaGroupId}`;
      setIsProcessing(prev => ({ ...prev, [id]: true }));
      
      const { data, error } = await supabase.functions.invoke('xdelo_sync_media_group', {
        body: { 
          messageId,
          mediaGroupId,
          forceSync: true 
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sync Complete",
        description: "Media group has been synchronized."
      });
      
      return {
        success: true,
        message: "Media group has been synchronized."
      };
    } catch (error) {
      console.error('Sync error:', error);
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync media group",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error occurred"
      };
    } finally {
      const id = messageId || `group_${mediaGroupId}`;
      setIsProcessing(prev => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    }
  }, [toast]);

  // Log an event and track state
  const logMessageOperation = useCallback(async (
    message: Message,
    action: string,
    details: Record<string, any> = {}
  ) => {
    try {
      await logEvent(
        LogEventType.USER_ACTION,
        message.id,
        {
          action,
          media_group_id: message.media_group_id,
          ...details
        }
      );
    } catch (error) {
      console.error(`Error logging ${action}:`, error);
    }
  }, []);

  return {
    isProcessing,
    errors,
    processMessageBatch,
    syncMessageCaption,
    logMessageOperation
  };
}
