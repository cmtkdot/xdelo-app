
import { supabase } from "@/integrations/supabase/client";
import LogEventType from "@/types/api/LogEventType";

export { LogEventType };

export interface LogEventOptions {
  entity_id?: string;
  event_type?: LogEventType | string;
  metadata?: any;
  user_id?: string;
  chat_id?: number;
  telegram_message_id?: number;
  correlation_id?: string;
  previous_state?: any;
  new_state?: any;
  error_message?: string;
}

export async function logEvent(
  eventType: LogEventType,
  entityId: string,
  metadata: any = {},
  options: Partial<LogEventOptions> = {}
) {
  try {
    const timestamp = new Date().toISOString();
    
    // Create the log event record
    const { data, error } = await supabase
      .from("unified_audit_logs")
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: metadata,
        event_timestamp: timestamp,
        user_id: options.user_id,
        chat_id: options.chat_id,
        telegram_message_id: options.telegram_message_id,
        correlation_id: options.correlation_id,
        previous_state: options.previous_state,
        new_state: options.new_state,
        error_message: options.error_message
      });

    if (error) {
      console.error("Failed to log event:", error);
    }

    return { success: !error, data, error };
  } catch (err) {
    console.error("Error in logEvent:", err);
    return { success: false, error: err };
  }
}

export function getEventTypeLabel(eventType: LogEventType): string {
  // Convert from enum value (e.g., MESSAGE_CREATED) to readable text (e.g., "Message Created")
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
