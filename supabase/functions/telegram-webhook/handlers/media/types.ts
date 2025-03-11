
import { ForwardInfo, MessageInput, ProcessingState } from '../../types';

export interface MediaInfo {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path: string;
  public_url: string | null;
  needs_redownload?: boolean;
  error?: string;
  mime_type?: string;
}

export interface MediaMessageHandlerResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MediaProcessingOptions {
  allowOverwrite?: boolean;
  forceReprocess?: boolean;
}
