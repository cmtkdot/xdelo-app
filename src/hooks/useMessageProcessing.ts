
import { useMessageAnalysis } from './useMessageAnalysis';
import { useMessageQueue } from './useMessageQueue';
import { useMediaGroupRepair } from './useMediaGroupRepair';

export function useMessageProcessing() {
  const { handleReanalyze, isProcessing, errors } = useMessageAnalysis();
  const { processMessageQueue, queueUnprocessedMessages } = useMessageQueue();
  const { repairMessageProcessingSystem } = useMediaGroupRepair();

  return {
    handleReanalyze,
    processMessageQueue,
    queueUnprocessedMessages,
    repairMessageProcessingSystem,
    isProcessing,
    errors
  };
}
