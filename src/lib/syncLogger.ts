
import { supabase } from "@/integrations/supabase/client";

/**
 * Logging utility for tracking operations using the unified audit logging system
 * This module provides client-side functions that integrate with the server-side
 * unified_audit_logs table through the log-operation edge function
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogMetadata {
  [key: string]: unknown;
}

/**
 * Log a deletion operation
 * @param messageId The ID of the message being deleted
 * @param source The source of the deletion (telegram, database, both)
 * @param metadata Additional metadata about the deletion
 */
export async function logDeletion(
  messageId: string,
  source: 'telegram' | 'database' | 'both',
  metadata: LogMetadata = {}
): Promise<void> {
  // Log to console for immediate feedback
  console.log(JSON.stringify({
    operation: 'deletion',
    message_id: messageId,
    source,
    timestamp: new Date().toISOString(),
    ...metadata
  }, null, 2));
  
  try {
    // Call the edge function to log the deletion
    await supabase.functions.invoke('log-operation', {
      body: {
        operation: 'deletion',
        messageId,
        source,
        metadata
      }
    });
  } catch (error) {
    console.error('Failed to log deletion:', error);
  }
}

/**
 * Log a message operation
 * @param operation The type of operation being performed
 * @param messageId The ID of the message
 * @param metadata Additional metadata about the operation
 */
export async function logMessageOperation(
  operation: 'create' | 'update' | 'analyze' | 'sync',
  messageId: string,
  metadata: LogMetadata = {}
): Promise<void> {
  // Log to console for immediate feedback
  console.log(JSON.stringify({
    operation,
    message_id: messageId,
    timestamp: new Date().toISOString(),
    ...metadata
  }, null, 2));
  
  try {
    // Call the edge function to log the operation
    await supabase.functions.invoke('log-operation', {
      body: {
        operation,
        messageId,
        metadata
      }
    });
  } catch (error) {
    console.error(`Failed to log ${operation}:`, error);
  }
}

/**
 * Log a user action
 * @param action The action being performed
 * @param userId The ID of the user performing the action
 * @param metadata Additional metadata about the action
 */
export async function logUserAction(
  action: string,
  userId: string,
  metadata: LogMetadata = {}
): Promise<void> {
  // Log to console for immediate feedback
  console.log(JSON.stringify({
    action,
    user_id: userId,
    timestamp: new Date().toISOString(),
    ...metadata
  }, null, 2));
  
  try {
    // Call the edge function to log the user action
    await supabase.functions.invoke('log-operation', {
      body: {
        operation: 'user_action',
        action,
        userId,
        metadata
      }
    });
  } catch (error) {
    console.error('Failed to log user action:', error);
  }
}
