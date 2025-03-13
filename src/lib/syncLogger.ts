
import { supabase } from "@/integrations/supabase/client";
import { logEvent, LogEventType } from "./logUtils";

export interface SyncLogEntry {
  id: string;
  operation: string;
  status: "pending" | "success" | "error";
  details?: any;
  created_at: string;
  updated_at: string;
  error_message?: string;
  user_id?: string;
  sync_counts?: {
    total?: number;
    processed?: number;
    succeeded?: number;
    failed?: number;
  };
}

export interface SyncLogOptions {
  userId?: string;
  metadata?: any;
}

export async function createSyncLog(
  operation: string,
  details: any = {},
  options: SyncLogOptions = {}
) {
  try {
    const { data, error } = await supabase
      .from("sync_logs")
      .insert({
        operation,
        status: "pending",
        details,
        user_id: options.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create sync log:", error);
    }

    // Also log to unified audit logs
    await logEvent(
      LogEventType.SYNC_STARTED,
      data?.id || "unknown",
      {
        operation,
        details,
        status: "pending",
      },
      {
        user_id: options.userId,
      }
    );

    return { success: !error, data, error };
  } catch (err) {
    console.error("Error in createSyncLog:", err);
    return { success: false, error: err };
  }
}

export async function updateSyncLog(
  id: string,
  status: "pending" | "success" | "error",
  details: any = {},
  errorMessage?: string
) {
  try {
    const { data, error } = await supabase
      .from("sync_logs")
      .update({
        status,
        details,
        updated_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update sync log:", error);
    }

    // Also log to unified audit logs
    const eventType = status === "success" 
      ? LogEventType.SYNC_COMPLETED 
      : status === "error" 
        ? LogEventType.SYNC_FAILED 
        : LogEventType.SYNC_STARTED;

    await logEvent(
      eventType,
      id,
      {
        status,
        details,
        error_message: errorMessage,
      }
    );

    return { success: !error, data, error };
  } catch (err) {
    console.error("Error in updateSyncLog:", err);
    return { success: false, error: err };
  }
}

export async function getSyncLogs(limit = 10) {
  try {
    const { data, error } = await supabase
      .from("sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch sync logs:", error);
    }

    return { success: !error, data, error };
  } catch (err) {
    console.error("Error in getSyncLogs:", err);
    return { success: false, error: err };
  }
}
