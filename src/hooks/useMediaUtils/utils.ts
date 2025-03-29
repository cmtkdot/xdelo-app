
import React from 'react';
import { supabase } from "@/integrations/supabase/client";
import { RetryHandler, shouldRetryOperation } from './retryHandler';

/**
 * Higher-order function to handle retrying operations with standardized error handling
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options = { 
    maxAttempts: 3, 
    baseDelayMs: 1000, 
    maxDelayMs: 10000, 
    retryableErrors: [],
    delay: undefined as number | undefined 
  }
): Promise<T> => {
  const retryHandler = new RetryHandler({
    maxAttempts: options.maxAttempts,
    baseDelayMs: options.baseDelayMs,
    maxDelayMs: options.maxDelayMs,
    retryableErrors: options.retryableErrors,
    delay: options.delay
  });
  
  try {
    return await retryHandler.execute(operation, shouldRetryOperation);
  } catch (error) {
    // Rethrow the error after retry attempts are exhausted
    throw error;
  }
};

/**
 * Create a standard media processing state manager
 */
export const createMediaProcessingState = () => {
  const [state, setState] = React.useState<{
    isProcessing: boolean;
    processingMessageIds: Record<string, boolean>;
  }>({
    isProcessing: false,
    processingMessageIds: {}
  });

  const actions = {
    setIsProcessing: (isProcessing: boolean) => {
      setState(prev => ({ ...prev, isProcessing }));
    },
    
    addProcessingMessageId: (messageId: string) => {
      setState(prev => ({
        ...prev,
        processingMessageIds: { ...prev.processingMessageIds, [messageId]: true }
      }));
    },
    
    removeProcessingMessageId: (messageId: string) => {
      setState(prev => {
        const updatedIds = { ...prev.processingMessageIds };
        delete updatedIds[messageId];
        return {
          ...prev,
          processingMessageIds: updatedIds
        };
      });
    }
  };

  return [state, actions] as const;
};

/**
 * Check if a caption is valid and not empty
 */
export const hasValidCaption = (caption: string | null | undefined): boolean => {
  return !!caption && caption.trim().length > 0;
};

/**
 * Validate if a string is a valid UUID
 */
export const isValidUuid = (str: string): boolean => {
  if (!str) return false;
  
  // UUID regex pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
};

/**
 * Helper function to safely extract properties from JSON data
 */
export const safeJsonExtract = <T>(json: any, propertyPath: string, defaultValue: T): T => {
  try {
    if (!json) return defaultValue;
    
    // Handle nested properties using a path like "result.updated_count"
    const parts = propertyPath.split('.');
    let current = json;
    
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined && current !== null 
      ? current as unknown as T 
      : defaultValue;
  } catch (err) {
    console.warn(`Error extracting ${propertyPath} from JSON:`, err);
    return defaultValue;
  }
};

/**
 * Add error catch and retry functionality to media group syncing
 */
export const syncMediaGroupWithRetry = async (
  messageId: string,
  mediaGroupId: string,
  analyzedContent: any,
  options: {
    forceSync?: boolean;
    syncEditHistory?: boolean;
    maxRetries?: number;
  } = {}
) => {
  const { forceSync = true, syncEditHistory = false, maxRetries = 3 } = options;
  let retryCount = 0;
  let lastError = null;

  const attemptSync = async () => {
    try {
      // Call the RPC function to sync the media group
      const { data, error } = await supabase.rpc('xdelo_sync_media_group_content', {
        p_message_id: messageId,
        p_analyzed_content: analyzedContent,
        p_force_sync: forceSync,
        p_sync_edit_history: syncEditHistory
      });

      if (error) throw error;
      
      // Safely extract updated_count from the response
      const updatedCount = safeJsonExtract(data, 'updated_count', 0);
      
      return { 
        success: true, 
        result: {
          ...data,
          updated_count: updatedCount
        }
      };
    } catch (err) {
      retryCount++;
      lastError = err;
      
      // Log the failure
      console.error(`Failed to sync media group (attempt ${retryCount}/${maxRetries}):`, err);
      
      // If we've reached the max retries, stop trying
      if (retryCount >= maxRetries) {
        console.error(`Max retries (${maxRetries}) reached for media group sync. Giving up.`);
        return { 
          success: false, 
          error: lastError, 
          retryCount 
        };
      }
      
      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
      console.log(`Retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
      // Try again
      return await attemptSync();
    }
  };

  return attemptSync();
};
