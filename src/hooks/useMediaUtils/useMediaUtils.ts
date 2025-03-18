
import { useState } from "react";
import { useSingleFileOperations } from "./singleFileOperations";
import { useBatchOperations } from "./batchOperations";
import { RepairResult, SyncCaptionResult, StandardizeResult } from "./types";

export const useMediaUtils = () => {
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Track processing state for individual messages
  const addProcessingMessageId = (id: string) => {
    setProcessingMessageIds(prev => ({ ...prev, [id]: true }));
  };

  const removeProcessingMessageId = (id: string) => {
    setProcessingMessageIds(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  // Single file operations
  const {
    reuploadMediaFromTelegram,
    fixContentDispositionForMessage,
    processMessage,
    reanalyzeMessageCaption,
    syncMessageCaption,
    standardizeStoragePaths
  } = useSingleFileOperations(
    addProcessingMessageId,
    removeProcessingMessageId
  );

  // Batch operations
  const {
    checkMissingFiles,
    fixAllContentDispositions,
    processAllPendingMessages,
    reanalyzeAllCaptions
  } = useBatchOperations(
    setIsProcessing,
    addProcessingMessageId,
    removeProcessingMessageId
  );

  return {
    // Processing state tracking
    processingMessageIds,
    isProcessing,
    
    // Single file operations
    reuploadMediaFromTelegram,
    fixContentDispositionForMessage,
    processMessage,
    reanalyzeMessageCaption,
    syncMessageCaption,
    standardizeStoragePaths,
    
    // Batch operations
    checkMissingFiles,
    fixAllContentDispositions,
    processAllPendingMessages,
    reanalyzeAllCaptions
  };
};
