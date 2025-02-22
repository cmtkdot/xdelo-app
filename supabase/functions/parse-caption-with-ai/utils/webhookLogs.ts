
import { SupabaseClient } from '@supabase/supabase-js';

export const logWebhookEvent = async (
  supabase: SupabaseClient,
  event_type: string,
  metadata: any = {},
  error_message?: string
) => {
  try {
    await supabase.from('webhook_logs').insert({
      event_type,
      metadata,
      error_message,
      correlation_id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging webhook event:', error);
  }
};
