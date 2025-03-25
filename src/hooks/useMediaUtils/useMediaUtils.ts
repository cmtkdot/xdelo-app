
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
    isUploading,
    isDeleting,
    uploadFile,
    deleteFile
  } = useSingleFileOperations();

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
    isUploading,
    isDeleting,
    
    // Single file operations
    uploadFile,
    deleteFile,
    
    // Batch operations
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages,
  };
}
