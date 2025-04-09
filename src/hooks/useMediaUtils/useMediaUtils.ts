
import { createMediaProcessingState } from './utils';
import { uploadFile, deleteFile, reuploadMediaFromTelegram } from './singleFileOperations';
import { 
  standardizeStoragePaths,
  fixMediaUrls,
  repairMediaBatch,
  processAllPendingMessages
} from './batchOperations';

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
  const isUploading = false; // Will be implemented with state
  const isDeleting = false; // Will be implemented with state

  return {
    // State
    isProcessing,
    processingMessageIds,
    isUploading,
    isDeleting,
    
    // Single file operations
    uploadFile,
    deleteFile,
    reuploadMediaFromTelegram,
    
    // Batch operations
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages,
  };
}
