
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../../_shared/cors.ts';
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_processMessageMedia,
  xdelo_detectMimeType
} from '../../_shared/mediaUtils.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
}

// Define interfaces for message context and Telegram message
interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: any;
}

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  photo?: any[];
  video?: any;
  document?: any;
  caption?: string;
  forward_from?: any;
  forward_from_chat?: any;
  forward_origin?: any;
  media_group_id?: string;
  edit_date?: number;
}

// Handle Telegram media messages
export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId } = context;
    
    console.log(`[${correlationId}] Processing media message ${message.message_id} in chat ${message.chat.id}`);
    
    // Extract the media from the message (photo, video, or document)
    const mediaContent = message.photo ? 
      message.photo[message.photo.length - 1] : 
      message.video || message.document;
    
    if (!mediaContent || !mediaContent.file_id) {
      throw new Error('No media content found in message');
    }
    
    // Check for duplicate messages to avoid reprocessing
    const { data: existingMessages } = await supabaseClient
      .from('messages')
      .select('id, file_unique_id, public_url')
      .eq('file_unique_id', mediaContent.file_unique_id)
      .limit(1);
    
    if (existingMessages && existingMessages.length > 0) {
      console.log(`[${correlationId}] Duplicate message detected, file already exists: ${mediaContent.file_unique_id}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          duplicate: true,
          message_id: existingMessages[0].id,
          public_url: existingMessages[0].public_url
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('Telegram bot token is missing');
    }
    
    // Process the media file
    const processResult = await xdelo_processMessageMedia(
      message,
      mediaContent.file_id,
      mediaContent.file_unique_id,
      TELEGRAM_BOT_TOKEN
    );
    
    if (!processResult.success) {
      throw new Error(`Failed to process media: ${processResult.error}`);
    }
    
    // Prepare message data for database
    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      is_forward: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      telegram_data: message,
      is_original_caption: true,
      ...processResult.fileInfo
    };
    
    // Insert message into database
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert(messageData)
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to insert message: ${insertError.message}`);
    }
    
    console.log(`[${correlationId}] Successfully processed and saved media message ${message.message_id}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        id: insertedMessage.id,
        storage_path: processResult.fileInfo.storage_path,
        public_url: processResult.fileInfo.public_url
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error handling media message:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    );
  }
}
