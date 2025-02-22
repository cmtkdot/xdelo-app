import { SupabaseClient } from '@supabase/supabase-js';
import { WebhookLogEntry } from '../types';

export async function logParserEvent(
  supabase: SupabaseClient,
  event: WebhookLogEntry
): Promise<void> {
  try {
    await supabase.from('webhook_logs').insert({
      ...event,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log parser event:', {
      error,
      correlation_id: event.correlation_id,
      event_type: event.event_type
    });
  }
} 