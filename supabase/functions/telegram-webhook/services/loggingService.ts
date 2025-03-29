
import { logProcessingEvent } from "../../_shared/consolidatedMessageUtils.ts";

/**
 * Log a processing event with standardized format
 */
export async function logEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    await logProcessingEvent(
      eventType,
      entityId,
      correlationId,
      metadata,
      errorMessage
    );
  } catch (error) {
    console.error(
      `Failed to log event ${eventType}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Log an error event with enhanced error details
 */
export async function logErrorEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  error: unknown,
  metadata: Record<string, any> = {}
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const enhancedMetadata = {
    ...metadata,
    error_type: typeof error,
    error_stack: errorStack,
  };
  
  await logEvent(eventType, entityId, correlationId, enhancedMetadata, errorMessage);
}
