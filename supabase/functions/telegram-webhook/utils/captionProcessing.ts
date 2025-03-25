
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger } from "./logger.ts";

/**
 * Process a message caption directly by calling the unified processor
 * 
 * @param messageId The ID of the message to process
 * @param correlationId Correlation ID for tracing
 * @param logger Logger instance
 * @returns Processing result
 */
export async function processMessageCaptionDirect(
  messageId: string,
  correlationId: string,
  logger: Logger
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    logger.info(`Directly calling unified processor for message ${messageId}`, {
      correlation_id: correlationId
    });
    
    // Call the unified processor directly
    const response = await fetch(`${supabaseUrl}/functions/v1/xdelo_unified_processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        operation: 'process_caption',
        messageId: messageId,
        force: false,
        correlationId: correlationId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to process caption: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    logger.info(`Caption processing result for message ${messageId}`, {
      success: result.success,
      data_preview: result.data ? JSON.stringify(result.data).substring(0, 100) + '...' : null
    });
    
    return result;
  } catch (error) {
    logger.error(`Error in processMessageCaptionDirect: ${error.message}`, {
      message_id: messageId,
      correlation_id: correlationId
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Schedule a media group sync after a delay
 * 
 * @param messageId The ID of the message to use as source
 * @param mediaGroupId The ID of the media group to sync
 * @param correlationId Correlation ID for tracing
 * @param logger Logger instance
 * @returns Scheduling result
 */
export async function scheduleMediaGroupSyncDirect(
  messageId: string,
  mediaGroupId: string,
  correlationId: string,
  logger: Logger
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    logger.info(`Scheduling delayed sync for media group ${mediaGroupId}`, {
      source_message_id: messageId,
      correlation_id: correlationId
    });
    
    // Call the unified processor directly
    const response = await fetch(`${supabaseUrl}/functions/v1/xdelo_unified_processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        operation: 'delayed_sync',
        messageId: messageId,
        mediaGroupId: mediaGroupId,
        correlationId: correlationId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to schedule media group sync: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    
    logger.info(`Media group sync scheduled for group ${mediaGroupId}`, {
      success: result.success
    });
    
    return result;
  } catch (error) {
    logger.error(`Error in scheduleMediaGroupSyncDirect: ${error.message}`, {
      message_id: messageId,
      media_group_id: mediaGroupId,
      correlation_id: correlationId
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}
