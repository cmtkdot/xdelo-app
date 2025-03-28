
import { RepairResult } from './types';

/**
 * Validates if a message has meaningful caption for processing
 */
export function hasValidCaption(caption?: string): boolean {
  return caption !== undefined && caption !== null && caption.trim().length > 0;
}

/**
 * Formats repair operation results into user-friendly format
 */
export function formatRepairResults(result: RepairResult): string {
  if (!result.success) {
    return `Repair failed: ${result.error || 'Unknown error'}`;
  }

  return `Repair completed: ${result.successful || 0} messages fixed, ${result.failed || 0} failed.`;
}

/**
 * Extracts Telegram file ID from storage path
 */
export function extractFileIdFromPath(path?: string): string | null {
  if (!path) return null;
  
  // Common pattern is {fileUniqueId}.{extension}
  const match = path.match(/^([A-Za-z0-9\-_]+)\./);
  return match ? match[1] : null;
}

/**
 * Determines if a string is a valid UUID
 */
export function isValidUuid(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}
