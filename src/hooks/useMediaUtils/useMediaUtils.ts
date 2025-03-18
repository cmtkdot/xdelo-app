
import { createMediaProcessingState } from './utils';
import { useSingleFileOperations } from './singleFileOperations';
import { useBatchOperations } from './batchOperations';

/**
 * A consolidated hook for media operations with improved organization
 */
export function useMediaUtils() {
  // Create state management
  const [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ] = createMediaProcessingState();

  // Initialize single file operations
  const {
    processMessage,
    reuploadMediaFromTelegram,
    fixContentDispositionForMessage,
    reanalyzeMessageCaption,
    syncMessageCaption
  } = useSingleFileOperations(addProcessingMessageId, removeProcessingMessageId);

  // Initialize batch operations
  const {
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages
  } = useBatchOperations(setIsProcessing, addProcessingMessageId, removeProcessingMessageId);

  return {
    // State
    isProcessing,
    processingMessageIds,
    
    // Single message operations
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    processMessage,
    reanalyzeMessageCaption,
    syncMessageCaption,
    
    // Batch operations
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages,
  };
}
