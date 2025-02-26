import { serve } from "http/server"
import { createClient } from "supabase"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error('Missing environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRole)

function getLogger(correlationId: string) {
  return {
    info: (message: string, data?: any) => {
      console.log(`[${correlationId}] ${message}`, data || '');
    },
    error: (message: string, error?: any) => {
      console.error(`[${correlationId}] ${message}`, error || '');
    }
  };
}

async function logAuditEvent(
  eventType: string,
  entityId: string,
  telegramMessageId: number | null,
  chatId: number | null,
  previousState: any = null,
  newState: any = null,
  metadata: any = null,
  correlationId: string | null = null,
  errorMessage: string | null = null
) {
  try {
    await supabase.rpc('xdelo_log_event', {
      p_event_type: eventType,
      p_entity_id: entityId,
      p_telegram_message_id: telegramMessageId,
      p_chat_id: chatId,
      p_previous_state: previousState,
      p_new_state: newState,
      p_metadata: metadata,
      p_correlation_id: correlationId,
      p_error_message: errorMessage
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

async function handleMediaGroup(messageId: string, mediaGroupId: string, logger: any) {
  try {
    const { data: analyzedMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .not('analyzed_content', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (analyzedMessage?.analyzed_content) {
      logger.info('Found existing analyzed content in media group');
      await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedMessage.analyzed_content,
          message_caption_id: analyzedMessage.id,
          is_original_caption: false,
          group_caption_synced: true,
          processing_state: 'completed'
        })
        .eq('id', messageId);
    }
  } catch (error) {
    logger.error('Error handling media group:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const logger = getLogger(correlationId);
  
  try {
    const rawBody = await req.text();
    logger.info('Raw request body:', rawBody);

    let update;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      logger.error('Failed to parse JSON:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = update.message || update.edited_message || 
                   update.channel_post || update.edited_channel_post;

    if (!message) {
      logger.info('No valid message in update');
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'no valid message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isEdit = !!update.edited_message || !!update.edited_channel_post;
    const chat = message.chat;
    const mediaGroupId = message.media_group_id;

    // Handle text messages (non-media)
    if (!message.photo && !message.video) {
      logger.info('Processing text message');
      
      await logAuditEvent(
        'message_received',
        message.message_id.toString(),
        message.message_id,
        chat.id,
        null,
        { message_type: 'text' },
        { message_text: message.text },
        correlationId
      );

      const { error: insertError } = await supabase
        .from('other_messages')
        .insert({
          chat_id: chat.id,
          chat_type: chat.type,
          chat_title: chat.title,
          telegram_message_id: message.message_id,
          message_text: message.text,
          message_type: 'text',
          is_edited: isEdit,
          telegram_data: update,
          correlation_id: correlationId,
          processing_state: 'completed'
        });

      if (insertError) throw insertError;

      return new Response(
        JSON.stringify({ 
          status: 'success',
          type: 'text_message',
          correlation_id: correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle media messages
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const media = photo || video;

    if (!media || !media.file_unique_id) {
      logger.info('No supported media found');
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'no supported media' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing media using file_unique_id
    const { data: existingMedia } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single();

    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: mediaGroupId,
      caption: message.caption || '',
      file_unique_id: media.file_unique_id,
      mime_type: video ? video.mime_type : 'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      processing_state: message.caption ? 'pending' : 'initialized',
      telegram_data: update,
      correlation_id: correlationId,
      is_edited: isEdit,
      edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null,
      message_url: `https://t.me/c/${Math.abs(chat.id).toString().substring(3)}/${message.message_id}`
    };

    let resultMessage;

    if (existingMedia) {
      logger.info('Updating existing media message');
      
      await logAuditEvent(
        'message_updated',
        existingMedia.id,
        message.message_id,
        chat.id,
        existingMedia,
        messageData,
        { is_edit: isEdit },
        correlationId
      );

      const { data: updated, error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMedia.id)
        .select()
        .single();

      if (updateError) throw updateError;
      resultMessage = updated;

      if (isEdit && message.caption !== existingMedia.caption) {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: existingMedia.id,
            caption: message.caption,
            correlationId,
            is_edit: true,
            media_group_id: mediaGroupId
          }
        });
      }
    } else {
      logger.info('Creating new media message');

      const { data: inserted, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      resultMessage = inserted;

      await logAuditEvent(
        'message_created',
        resultMessage.id,
        message.message_id,
        chat.id,
        null,
        messageData,
        { media_type: video ? 'video' : 'photo' },
        correlationId
      );

      if (mediaGroupId) {
        await handleMediaGroup(resultMessage.id, mediaGroupId, logger);
      }

      if (message.caption) {
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: resultMessage.id,
            caption: message.caption,
            correlationId,
            media_group_id: mediaGroupId
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        correlation_id: correlationId,
        message: 'Message processed',
        messageId: resultMessage.id,
        isEdit,
        hasCaption: !!message.caption,
        mediaGroupId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    logger.error('Error processing webhook:', error);

    await logAuditEvent(
      'webhook_error',
      'system',
      null,
      null,
      null,
      null,
      { error: error.message, stack: error.stack },
      correlationId,
      error.message
    );

    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
