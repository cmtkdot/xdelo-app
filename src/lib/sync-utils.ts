
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
  event_type: string,
  details: any,
  status: 'success' | 'error'
) {
  const { data, error } = await supabase
    .from('gl_sync_logs')
    .insert([
      {
        event_type,
        details,
        status,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating sync log:', error);
    throw error;
  }

  return data;
}
