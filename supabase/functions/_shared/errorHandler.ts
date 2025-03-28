import { supabaseClient } from './supabase.ts'; // Import the singleton client

interface ErrorLogParams {
  messageId: string;
  errorMessage: string;
  correlationId?: string;
  functionName?: string;
  additionalData?: Record<string, any>;
}

// Removed local client initialization

// Removed redundant logErrorToDatabase function. Use logProcessingEvent from consolidatedMessageUtils.ts instead.

/**
 * Update a message with error state
 */
export async function updateMessageWithError(messageId: string, errorMessage: string): Promise<void> {
  try {
    // Use the imported singleton client
    await supabaseClient
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: errorMessage,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
  } catch (error) {
    console.error('Error updating message with error state:', error);
    // Already in error handler, just log
  }
}
