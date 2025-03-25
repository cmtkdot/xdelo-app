
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramEventRequest {
  messageId: string;
  eventType: string;
  context?: Record<string, any>;
}

interface MessageData {
  id: string;
  telegram_message_id?: number;
  media_group_id?: string;
  caption?: string;
  file_id?: string;
  file_unique_id?: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  chat_id?: number;
  chat_type?: string;
  chat_title?: string;
  processing_state?: string;
  analyzed_content?: Record<string, any>;
  telegram_data?: Record<string, any>;
  is_forward?: boolean;
  forward_info?: Record<string, any>;
  edit_history?: Record<string, any>[];
  edit_count?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow for additional properties
}

/**
 * Creates an event payload based on event type and message data
 */
function createEventPayload(eventType: string, message: MessageData, context: Record<string, any> = {}): Record<string, any> {
  const basePayload = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    message_id: message.id,
    context
  };
  
  switch (eventType) {
    case 'message_received':
      return {
        ...basePayload,
        message: {
          id: message.id,
          telegram_id: message.telegram_message_id,
          text: message.caption || '',
          chat: {
            id: message.chat_id,
            type: message.chat_type,
            title: message.chat_title
          },
          date: message.created_at
        }
      };
      
    case 'media_received':
      return {
        ...basePayload,
        media: {
          id: message.id,
          type: message.mime_type?.split('/')[0] || 'unknown',
          file_id: message.file_id,
          file_unique_id: message.file_unique_id,
          file_size: message.file_size,
          width: message.width,
          height: message.height,
          duration: message.duration,
          mime_type: message.mime_type,
          url: message.public_url
        },
        message: {
          caption: message.caption,
          chat_id: message.chat_id,
          chat_title: message.chat_title
        }
      };
      
    case 'message_edited':
      return {
        ...basePayload,
        edit: {
          count: message.edit_count,
          history: message.edit_history,
          timestamp: message.updated_at
        },
        message: {
          id: message.id,
          telegram_id: message.telegram_message_id,
          text: message.caption || '',
          chat: {
            id: message.chat_id,
            type: message.chat_type,
            title: message.chat_title
          },
          original_date: message.created_at
        }
      };
      
    case 'message_forwarded':
      return {
        ...basePayload,
        forward: message.forward_info,
        is_forward: message.is_forward,
        message: {
          id: message.id,
          telegram_id: message.telegram_message_id,
          text: message.caption || '',
          chat: {
            id: message.chat_id,
            type: message.chat_type,
            title: message.chat_title
          }
        }
      };
      
    case 'media_group_received':
      return {
        ...basePayload,
        media_group: {
          id: message.media_group_id,
          item_id: message.id,
          item_type: message.mime_type?.split('/')[0] || 'unknown'
        },
        message: {
          id: message.id,
          telegram_id: message.telegram_message_id,
          caption: message.caption,
          chat: {
            id: message.chat_id,
            type: message.chat_type,
            title: message.chat_title
          }
        }
      };
      
    case 'caption_updated':
      return {
        ...basePayload,
        caption: {
          text: message.caption,
          previous: context.previous_caption
        },
        message: {
          id: message.id,
          telegram_id: message.telegram_message_id,
          chat: {
            id: message.chat_id,
            type: message.chat_type,
            title: message.chat_title
          }
        }
      };
      
    case 'processing_completed':
      return {
        ...basePayload,
        processing: {
          state: message.processing_state,
          completed_at: message.updated_at,
          duration_ms: context.processing_duration,
          analyzed_content: message.analyzed_content
        },
        message: {
          id: message.id,
          telegram_id: message.telegram_message_id,
          text: message.caption || '',
          chat: {
            id: message.chat_id,
            type: message.chat_type,
            title: message.chat_title
          }
        }
      };
      
    default:
      // For custom event types, return the full message data
      return {
        ...basePayload,
        data: message
      };
  }
}

/**
 * Forwards an event to the webhook sender
 */
async function forwardToWebhooks(eventType: string, payload: Record<string, any>, messageId: string): Promise<any> {
  // Find all active webhooks that handle this event type
  const { data: webhooks, error: webhookError } = await supabase
    .from('make_webhook_configs')
    .select('id')
    .eq('is_active', true)
    .contains('event_types', [eventType]);
  
  if (webhookError) {
    throw new Error(`Error finding webhooks: ${webhookError.message}`);
  }
  
  if (!webhooks || webhooks.length === 0) {
    return { webhooks_found: 0, message: 'No active webhooks found for this event type' };
  }
  
  // Forward to each webhook
  const results = [];
  
  for (const webhook of webhooks) {
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_make-webhook-sender', {
        body: {
          webhookId: webhook.id,
          eventType,
          payload,
          messageId
        }
      });
      
      results.push({
        webhook_id: webhook.id,
        success: !error,
        data,
        error: error?.message
      });
    } catch (error) {
      results.push({
        webhook_id: webhook.id,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    webhooks_found: webhooks.length,
    results
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageId, eventType, context = {} } = await req.json() as TelegramEventRequest;
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'Missing messageId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!eventType) {
      return new Response(
        JSON.stringify({ error: 'Missing eventType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch message data
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      return new Response(
        JSON.stringify({ error: `Message not found: ${messageError?.message || 'Unknown error'}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create event payload
    const payload = createEventPayload(eventType, message, context);
    
    // Forward to webhooks
    const webhookResults = await forwardToWebhooks(eventType, payload, messageId);
    
    // Log the event
    const { data: eventLog, error: logError } = await supabase
      .from('make_telegram_events')
      .insert({
        message_id: messageId,
        event_type: eventType,
        payload,
        webhook_results: webhookResults,
        context
      })
      .select()
      .single();
    
    if (logError) {
      console.error('Error logging event:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventLog?.id,
        event_type: eventType,
        webhook_results: webhookResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error processing Telegram event:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
