
export interface MessageQueueItem {
  queue_id: string;
  message_id: string;
  correlation_id: string;
  caption: string;
  media_group_id?: string;
  storage_path?: string;
  mime_type?: string;
  file_unique_id: string;
  public_url?: string;
}

export interface StorageValidationResult {
  isValid: boolean;
  storagePath: string;
  publicUrl: string;
  needsRedownload: boolean;
}

export interface MessageData {
  id: string;
  caption?: string;
  media_group_id?: string;
  file_unique_id: string;
  storage_path?: string;
  mime_type?: string;
  public_url?: string;
}

export interface ProcessingResults {
  processed: number;
  success: number;
  failed: number;
  details: Array<{
    message_id: string;
    queue_id: string;
    status: 'success' | 'error';
    result?: any;
    error_message?: string;
  }>;
}
