
import { xdelo_getExtensionFromMimeType } from './mimeTypes.ts';

// Standardize storage path generation
export function xdelo_generateStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('Missing file_unique_id for storage path generation');
  }
  
  const extension = xdelo_getExtensionFromMimeType(mimeType || 'application/octet-stream');
  return `${fileUniqueId}.${extension}`;
}

// Validate and fix a storage path if needed
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('File unique ID is required for storage path generation');
  }
  
  return xdelo_generateStoragePath(fileUniqueId, mimeType || 'application/octet-stream');
}
