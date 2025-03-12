
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../../_shared/cors.ts';
import { 
  xdelo_detectMimeType,
  xdelo_validateAndFixStoragePath,
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage
} from '../../_shared/mediaUtils.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Simplified media message handler
export async function handleMediaMessage(message: any, context: any): Promise<Response> {
  try {
    const { correlationId } = context;
    const mediaType = getMediaType(message);
    
    // Extract media info
    const { fileId, fileUniqueId, width, height, duration, fileSize, mimeType } = extractMediaInfo(message, mediaType);
    
    if (!fileId || !fileUniqueId) {
      throw new Error('Missing required file information');
    }
    
    // Check if this is an edited message
    if (context.isEdit) {
      return await handleEditedMediaMessage(message, fileUniqueId, context);
    }
    
    // Check if message already exists
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('id, file_unique_id, caption, storage_path, public_url, processing_state, analyzed_content')
      .eq('file_unique_id', fileUniqueId)
      .eq('chat_id', message.chat.id)
      .limit(1)
      .single();
      
    if (existingMessage) {
      return await handleExistingMediaMessage(message, existingMessage, context);
    }
    
    // Create a standardized storage path
    const storagePath = xdelo_validateAndFixStoragePath(fileUniqueId, mimeType);
    
    // Generate a public URL for the file
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;
    
    // Prepare forward info if message is forwarded
    const forwardInfo = message.forward_origin ? {
      is_forward: true,
      forward_origin_type: message.forward_origin.type,
      forward_from_chat_id: message.forward_origin.chat?.id,
      forward_from_chat_title: message.forward_origin.chat?.title,
      forward_from_message_id: message.forward_origin.message_id,
      forward_date: message.forward_origin.date * 1000
    } : undefined;
    
    // Insert new message
    const { data: insertedMessage, error: insertError } = await supabaseClient
      .from('messages')
      .insert({
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        caption: message.caption,
        media_group_id: message.media_group_id,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: mimeType,
        width: width,
        height: height,
        duration: duration,
        file_size: fileSize,
        correlation_id: correlationId,
        processing_state: message.caption ? 'pending' : 'completed',
        telegram_data: message,
        is_forward: !!forwardInfo,
        forward_info: forwardInfo,
        telegram_date: new Date(message.date * 1000).toISOString(),
        message_type: mediaType,
        is_bot: !!message.from?.is_bot,
        from_id: message.from?.id
      })
      .select('id')
      .single();
      
    if (insertError) {
      throw insertError;
    }
    
    // Log the insertion
    console.log(JSON.stringify({
      level: 'info',
      message: 'New media message created',
      message_id: insertedMessage.id,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      media_type: mediaType,
      correlation_id: correlationId
    }));
    
    // If message has caption, trigger analysis
    if (message.caption && insertedMessage?.id) {
      try {
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            message_id: insertedMessage.id,
            correlation_id: correlationId
          }
        });
      } catch (analysisError) {
        console.warn('Failed to trigger caption analysis:', analysisError);
        // Continue - this is non-fatal
      }
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling media message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Generic message handler for non-media messages
export async function handleOtherMessage(message: any, context: any): Promise<Response> {
  try {
    const { correlationId } = context;
    
    // Store in other_messages table
    const { error } = await supabaseClient
      .from('other_messages')
      .insert({
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_type: 'text',
        telegram_data: message,
        correlation_id: correlationId,
        is_forward: !!message.forward_origin,
        message_text: message.text || '',
        processing_state: 'completed',
        telegram_date: new Date(message.date * 1000).toISOString(),
        is_bot: !!message.from?.is_bot,
        from_id: message.from?.id
      });
      
    if (error) {
      throw error;
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling other message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Helper function to get media type
function getMediaType(message: any): string {
  if (message.photo) return 'photo';
  if (message.video) return 'video';
  if (message.document) return 'document';
  if (message.audio) return 'audio';
  if (message.voice) return 'voice';
  if (message.animation) return 'animation';
  if (message.sticker) return 'sticker';
  return 'unknown';
}

// Extract media info based on media type
function extractMediaInfo(message: any, mediaType: string): { 
  fileId: string; 
  fileUniqueId: string; 
  width?: number; 
  height?: number; 
  duration?: number; 
  fileSize?: number;
  mimeType: string;
} {
  let fileId = '';
  let fileUniqueId = '';
  let width = undefined;
  let height = undefined;
  let duration = undefined;
  let fileSize = undefined;
  
  // Get file info based on media type
  switch (mediaType) {
    case 'photo':
      // Get the largest photo (last in array)
      const photo = message.photo[message.photo.length - 1];
      fileId = photo.file_id;
      fileUniqueId = photo.file_unique_id;
      width = photo.width;
      height = photo.height;
      break;
    case 'video':
      fileId = message.video.file_id;
      fileUniqueId = message.video.file_unique_id;
      width = message.video.width;
      height = message.video.height;
      duration = message.video.duration;
      fileSize = message.video.file_size;
      break;
    case 'document':
      fileId = message.document.file_id;
      fileUniqueId = message.document.file_unique_id;
      fileSize = message.document.file_size;
      break;
    case 'audio':
      fileId = message.audio.file_id;
      fileUniqueId = message.audio.file_unique_id;
      duration = message.audio.duration;
      fileSize = message.audio.file_size;
      break;
    case 'voice':
      fileId = message.voice.file_id;
      fileUniqueId = message.voice.file_unique_id;
      duration = message.voice.duration;
      fileSize = message.voice.file_size;
      break;
    case 'animation':
      fileId = message.animation.file_id;
      fileUniqueId = message.animation.file_unique_id;
      width = message.animation.width;
      height = message.animation.height;
      duration = message.animation.duration;
      fileSize = message.animation.file_size;
      break;
    case 'sticker':
      fileId = message.sticker.file_id;
      fileUniqueId = message.sticker.file_unique_id;
      width = message.sticker.width;
      height = message.sticker.height;
      break;
  }
  
  // Detect MIME type
  const mediaObj = {
    photo: message.photo,
    video: message.video,
    document: message.document,
    audio: message.audio,
    voice: message.voice,
    animation: message.animation,
    sticker: message.sticker
  };
  
  const mimeType = xdelo_detectMimeType(mediaObj);
  
  return { fileId, fileUniqueId, width, height, duration, fileSize, mimeType };
}

// Handle edited media messages
async function handleEditedMediaMessage(message: any, fileUniqueId: string, context: any): Promise<Response> {
  try {
    const { correlationId } = context;
    
    // Find the existing message
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .single();
      
    if (!existingMessage) {
      // Message doesn't exist - treat as new message
      return await handleMediaMessage(message, { ...context, isEdit: false });
    }
    
    // Check if the caption has changed
    const captionChanged = message.caption !== existingMessage.caption;
    
    // Update the message
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        caption: message.caption,
        correlation_id: correlationId,
        is_edit: true,
        edit_count: (existingMessage.edit_count || 0) + 1,
        edit_date: new Date(message.edit_date * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        // Reset processing state and analyzed content if caption changed
        processing_state: captionChanged ? 'pending' : existingMessage.processing_state,
        analyzed_content: captionChanged ? null : existingMessage.analyzed_content,
        group_caption_synced: captionChanged ? false : existingMessage.group_caption_synced
      })
      .eq('id', existingMessage.id);
      
    if (updateError) {
      throw updateError;
    }
    
    // If caption changed, trigger analysis
    if (captionChanged) {
      try {
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            message_id: existingMessage.id,
            correlation_id: correlationId,
            is_edit: true
          }
        });
      } catch (analysisError) {
        console.warn('Failed to trigger caption analysis for edit:', analysisError);
        // Continue - this is non-fatal
      }
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling edited media message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Handle existing media messages
async function handleExistingMediaMessage(message: any, existingMessage: any, context: any): Promise<Response> {
  try {
    const { correlationId } = context;
    
    // Check if the caption has changed
    const captionChanged = message.caption !== existingMessage.caption;
    
    // Update the message
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        caption: message.caption,
        telegram_message_id: message.message_id, // Update with latest message ID
        correlation_id: correlationId,
        updated_at: new Date().toISOString(),
        // Reset processing state and analyzed content if caption changed
        processing_state: captionChanged ? 'pending' : existingMessage.processing_state,
        analyzed_content: captionChanged ? null : existingMessage.analyzed_content,
        group_caption_synced: captionChanged ? false : existingMessage.group_caption_synced,
        forward_count: (existingMessage.forward_count || 0) + (message.forward_origin ? 1 : 0)
      })
      .eq('id', existingMessage.id);
      
    if (updateError) {
      throw updateError;
    }
    
    // If caption changed, trigger analysis
    if (captionChanged) {
      try {
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            message_id: existingMessage.id,
            correlation_id: correlationId
          }
        });
      } catch (analysisError) {
        console.warn('Failed to trigger caption analysis for existing message:', analysisError);
        // Continue - this is non-fatal
      }
    }
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling existing media message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}
