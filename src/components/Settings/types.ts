
export interface SyncLog {
  id: string;
  table_name: string;
  operation: string;
  status: 'success' | 'error' | 'pending';
  error_message?: string;
  created_at: string;
}
