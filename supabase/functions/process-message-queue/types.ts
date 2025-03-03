
/**
 * Types for message processing queue
 */

export interface ProcessingResults {
  processed: number;
  success: number;
  failed: number;
  details: Array<{
    message_id: string;
    queue_id: string;
    status: 'success' | 'error';
    result?: any;
    error?: string;
  }>;
}

export interface MessageQueueItem {
  queue_id: string;
  message_id: string;
  correlation_id: string;
  caption: string;
  media_group_id?: string;
}

export interface MessageData {
  id: string;
  file_unique_id: string;
  file_id?: string;
  storage_path: string | null;
  mime_type: string | null;
  caption?: string;
  media_group_id?: string;
  file_id_expires_at?: string;
  original_file_id?: string;
  redownload_strategy?: string;
  [key: string]: any;
}

export interface StorageValidationResult {
  isValid: boolean;
  storagePath: string;
  publicUrl: string;
  needsRedownload: boolean;
}
