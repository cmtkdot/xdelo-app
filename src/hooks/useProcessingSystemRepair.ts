
import { useProcessingStats } from './useProcessingStats';
import { useSystemRepair } from './useSystemRepair';
import { useStuckMessageRepair } from './useStuckMessageRepair';

/**
 * Unified hook that combines all processing system repair functionality
 */
export function useProcessingSystemRepair() {
  // Use the individual hooks
  const { getProcessingStats } = useProcessingStats();
  const { repairProcessingSystem, isRepairing: isSystemRepairing } = useSystemRepair();
  const { repairStuckMessages, isRepairing: isStuckRepairing } = useStuckMessageRepair();
  
  // Combine the isRepairing states
  const isRepairing = isSystemRepairing || isStuckRepairing;

  return {
    repairProcessingSystem,
    getProcessingStats,
    isRepairing,
    repairStuckMessages
  };
}
