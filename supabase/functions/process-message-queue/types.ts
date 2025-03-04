
export interface MessageQueueItem {
  queue_id: string;
  message_id: string;
  correlation_id: string; // Explicitly defined as string 
  caption: string;
  media_group_id?: string;
  storage_path?: string;
  mime_type?: string;
  file_unique_id?: string;
  public_url?: string;
}

export interface ProcessingDetail {
  message_id: string;
  queue_id: string;
  status: 'success' | 'error';
  result?: any;
  error_message?: string;
}

export interface ProcessingResults {
  processed: number;
  success: number;
  failed: number;
  details: ProcessingDetail[];
}
