
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/types";

export async function getSyncLogs() {
  const { data: logs } = await supabase
    .from('gl_sync_logs')
    .select('*')
    .order('created_at', { ascending: false });

  return logs;
}

export async function createSyncLog(
  operation: string,
  recordId: string,
  tableName: string,
  status: string,
  errorMessage?: string
) {
  const { data, error } = await supabase
    .from('gl_sync_logs')
    .insert([
      {
        operation,
        record_id: recordId,
        table_name: tableName,
        status,
        error_message: errorMessage
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating sync log:', error);
    throw error;
  }

  return data;
}
