
export interface SyncLog {
  id: string;
  table_name: string;
  record_id: string;
  glide_id: string;
  operation: string;
  status: string;
  created_at: string;
  error_message?: string;
}
