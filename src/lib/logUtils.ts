
import { supabase } from "@/integrations/supabase/client";
import { Logger, LogEventType, createLogger, logEvent } from "./logger";

/**
 * Create a logger for a specific component or feature
 */
export function createComponentLogger(component: string): Logger {
  return createLogger(`component:${component}`);
}

/**
 * Log an event to the unified logging system
 */
export async function logSystemEvent(
  eventType: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    const entityId = 'system';
    const correlationId = crypto.randomUUID().toString();
    
    await supabase.functions.invoke('log-operation', {
      body: {
        eventType,
        entityId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        },
        errorMessage
      }
    });
  } catch (error) {
    console.error('Failed to log system event:', error);
  }
}

// Re-export these from logger for backwards compatibility
export { logEvent, LogEventType };
