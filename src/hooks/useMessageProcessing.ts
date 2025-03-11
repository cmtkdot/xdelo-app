
import { useMessageAnalysis } from './useMessageAnalysis';
import { useMessageQueue } from './useMessageQueue';
import { useMediaGroupRepair } from './useMediaGroupRepair';
import { useProcessingSystemRepair } from './useProcessingSystemRepair';

/**
 * Unified hook that combines all message processing functionality
 * This acts as a facade to simplify access to the various processing hooks
 */
export function useMessageProcessing() {
  // Use the individual hooks
  const { handleReanalyze, isProcessing, errors } = useMessageAnalysis();
  const { processMessageQueue, queueUnprocessedMessages } = useMessageQueue();
  const { repairMessageProcessingSystem } = useMediaGroupRepair();
  const { 
    repairProcessingSystem, 
    repairStuckMessages, 
    getProcessingStats, 
    isRepairing 
  } = useProcessingSystemRepair();

  return {
    // Message analysis
    handleReanalyze,
    isProcessing,
    errors,

    // Queue operations
    processMessageQueue,
    queueUnprocessedMessages,
    
    // Repair operations
    repairMessageProcessingSystem,
    repairProcessingSystem,
    repairStuckMessages,
    
    // System status
    getProcessingStats,
    isRepairing
  };
}
