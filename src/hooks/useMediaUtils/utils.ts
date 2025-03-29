
import { supabase } from '@/integrations/supabase/client';
import { useState, useCallback } from 'react';
// Removed incorrect import for ensureMessagesCompatibility

/**
 * Media processing state and actions
 */
export interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: string[];
}

export interface MediaProcessingActions {
  setIsProcessing: (isProcessing: boolean) => void;
  addProcessingMessageId: (messageId: string) => void;
  removeProcessingMessageId: (messageId: string) => void;
}

/**
 * Options for media sync operations
 */
export interface MediaSyncOptions {
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

/**
 * Result from sync operations
 */
export interface SyncResult {
  success: boolean;
  error?: Error | null;
  result?: Json | null; // Changed any to Json | null
}

/**
 * Custom hook to manage media processing state
 */
export function useMediaProcessingState(): [MediaProcessingState, MediaProcessingActions] { // Renamed function
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<string[]>([]);

  const addProcessingMessageId = useCallback((messageId: string) => {
    setProcessingMessageIds((prev) => [...prev, messageId]);
  }, []);

  const removeProcessingMessageId = useCallback((messageId: string) => {
    setProcessingMessageIds((prev) => prev.filter((id) => id !== messageId));
  }, []);

  return [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ];
}

/**
 * Check if a message has a valid caption
 */
export function hasValidCaption(caption?: string): boolean {
  return Boolean(caption && caption.trim().length > 0);
}

/**
 * Validate a UUID string
 */
export function isValidUuid(id?: string): boolean {
  if (!id) return false;
  const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
  return regexExp.test(id);
}

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
}

/**
 * Retry a database operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<{ data: T | null; error: Error | null }>, // Changed error: any
  options: RetryOptions = {}
): Promise<{ data: T | null; error: Error | null; retryCount?: number }> { // Changed error: any
  const maxAttempts = options.maxAttempts || 3;
  const baseDelayMs = options.baseDelayMs || 1000;
  const maxDelayMs = options.maxDelayMs || 10000;
  const retryableErrors = options.retryableErrors || [];

  let attempts = 0;
  let lastError = null;

  while (attempts < maxAttempts) {
    try {
      const result = await operation();
      
      if (result.error) {
        lastError = result.error;
        
        // Check if we should retry this error
        const shouldRetry = retryableErrors.length === 0 || 
          retryableErrors.some(errType => 
            result.error.message?.includes(errType) || 
            result.error.code?.includes(errType)
          );
          
        if (!shouldRetry) {
          return { ...result, retryCount: attempts };
        }
      } else {
        // Success, return the result
        return attempts > 0 
          ? { ...result, retryCount: attempts }
          : result;
      }
    } catch (error) {
      lastError = error;
    }
    
    // Increment attempt counter
    attempts++;
    
    // Don't delay if this was the last attempt
    if (attempts >= maxAttempts) break;
    
    // Calculate backoff with jitter
    const jitter = Math.random() * 0.2 - 0.1; // ±10% jitter
    const delay = Math.min(
      baseDelayMs * Math.pow(2, attempts - 1),
      maxDelayMs
    ) * (1 + jitter);
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // If we get here, we've exhausted all retry attempts
  return { data: null, error: lastError, retryCount: attempts };
}

/**
 * Sync media group content with retry mechanism
 */
export async function syncMediaGroupWithRetry(
  messageId: string,
  mediaGroupId: string,
  analyzedContent: Json | null, // Changed any to Json | null
  options: MediaSyncOptions & { maxRetries?: number } = {}
): Promise<SyncResult> {
  try {
    const { data, error, retryCount } = await withRetry(
      () => supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_message_id: messageId,
          p_analyzed_content: analyzedContent,
          p_force_sync: options.forceSync !== false,
          p_sync_edit_history: !!options.syncEditHistory
        }
      ),
      {
        maxAttempts: options.maxRetries || 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        retryableErrors: ['timeout', 'connection', 'network']
      }
    );
    
    if (error) {
      return {
        success: false,
        error: new Error(error.message || 'Unknown error syncing media group')
      };
    }
    
    return {
      success: true,
      result: data
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err))
    };
  }
}
