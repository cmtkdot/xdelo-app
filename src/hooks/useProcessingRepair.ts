import { useState, useCallback } from 'react';
import { useToast } from "@/hooks/useToast";
import { reprocessMessage } from '@/lib/api';
import { logEvent, LogEventType } from '@/lib/logUtils';

interface UseProcessingRepairResult {
  isProcessing: boolean;
  error: string | null;
  startProcessing: (messageId: string, forceRedownload?: boolean, reanalyzeCaption?: boolean) => Promise<void>;
}

export const useProcessingRepair = (): UseProcessingRepairResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const startProcessing = useCallback(async (messageId: string, forceRedownload = false, reanalyzeCaption = false) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Log the start of the reprocessing operation
      await logEvent(
        LogEventType.SYSTEM_REPAIR,
        messageId,
        {
          action: 'reprocess_message',
          status: 'started',
          options: { forceRedownload, reanalyzeCaption }
        }
      );

      // Call the reprocessMessage API
      const response = await reprocessMessage(messageId, {
        forceRedownload,
        reanalyzeCaption,
      });

      if (!response.success) {
        setError(response.error || 'Failed to reprocess message.');
        toast({
          title: "Reprocessing Failed",
          description: response.error || "An error occurred while reprocessing the message.",
          variant: "destructive",
        });

        // Log the failure
        await logEvent(
          LogEventType.SYSTEM_REPAIR,
          messageId,
          {
            action: 'reprocess_message',
            status: 'failed',
            options: { forceRedownload, reanalyzeCaption }
          },
          {
            error_message: response.error
          }
        );
        return;
      }

      toast({
        title: "Reprocessing Started",
        description: "Message reprocessing has been initiated.",
      });

      // Log the success
      await logEvent(
        LogEventType.SYSTEM_REPAIR,
        messageId,
        {
          action: 'reprocess_message',
          status: 'completed',
          options: { forceRedownload, reanalyzeCaption }
        }
      );

    } catch (e: any) {
      const errorMessage = e.message || 'An unexpected error occurred.';
      setError(errorMessage);
      toast({
        title: "Unexpected Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Log the exception
      await logEvent(
        LogEventType.SYSTEM_ERROR,
        messageId,
        {
          action: 'reprocess_message',
          status: 'exception',
          options: { forceRedownload, reanalyzeCaption }
        },
        {
          error_message: errorMessage
        }
      );

    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  return { isProcessing, error, startProcessing };
};
