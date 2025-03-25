
import { createMediaProcessingState } from './utils';
import { useSingleFileOperations } from './singleFileOperations';
import { useBatchOperations } from './batchOperations';
import { 
  processMessageCaption, 
  syncMediaGroup,
  processDelayedMediaGroupSync, 
  reprocessMessage 
} from '@/lib/unifiedProcessor';

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
    deleteFile,
    reuploadMediaFromTelegram
  } = useSingleFileOperations();

  // Initialize batch operations
  const {
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages
  } = useBatchOperations(setIsProcessing, addProcessingMessageId, removeProcessingMessageId);
  
  // Add unified processor operations
  const processCaption = async (messageId: string, force: boolean = false) => {
    addProcessingMessageId(messageId);
    try {
      const result = await processMessageCaption(messageId, force);
      return result;
    } finally {
      removeProcessingMessageId(messageId);
    }
  };
  
  const syncGroup = async (sourceMessageId: string, mediaGroupId: string, force: boolean = false) => {
    addProcessingMessageId(sourceMessageId);
    try {
      const result = await syncMediaGroup(sourceMessageId, mediaGroupId, force);
      return result;
    } finally {
      removeProcessingMessageId(sourceMessageId);
    }
  };
  
  const processDelayedSync = async (mediaGroupId: string) => {
    setIsProcessing(true);
    try {
      const result = await processDelayedMediaGroupSync(mediaGroupId);
      return result;
    } finally {
      setIsProcessing(false);
    }
  };
  
  const reprocess = async (messageId: string, force: boolean = true) => {
    addProcessingMessageId(messageId);
    try {
      const result = await reprocessMessage(messageId, force);
      return result;
    } finally {
      removeProcessingMessageId(messageId);
    }
  };

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
    
    // Unified processor operations
    processCaption,
    syncGroup,
    processDelayedSync,
    reprocess
  };
}
