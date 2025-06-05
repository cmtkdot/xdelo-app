
/**
 * Interface for response from media group sync operation
 */
export interface MediaGroupResult {
  success: boolean;
  updated_count?: number;
  sync_timestamp?: string;
  media_group_id?: string;
  error?: string;
}
