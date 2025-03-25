import { corsHeaders } from "../../utils/cors.ts";
import { supabaseClient } from "../../utils/supabase.ts";
import { xdelo_processMessageMedia } from "../../utils/media/mediaStorage.ts";
import { hasCaption, extractCaption, prepareEditHistoryEntry } from "../../utils/messageUtils.ts";
import { xdelo_logProcessingEvent } from "../../utils/databaseOperations.ts";

// Define the handler function for edited media messages
export async function handleEditedMediaMessage(message: any, context: any) {
  try {
    const { isChannelPost, correlationId, logger } = context;

    // Extract relevant information from the message
    const telegramMessageId = message.message_id;
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const chatTitle = message.chat.title;
    const captionText = extractCaption(message);
    const editDate = message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString();

    logger.info("Processing edited media message", {
      message_id: telegramMessageId,
      chat_id: chatId,
      has_caption: hasCaption(message),
    });

    // Step 1: Check if message exists in database
    const { data: existingMessage, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', telegramMessageId)
      .eq('chat_id', chatId)
      .single();

    if (fetchError) {
      logger.error("Error finding existing message:", fetchError);
      return new Response(
        JSON.stringify({ error: `Database error: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Found existing message to update", {
      message_id: telegramMessageId,
      database_id: existingMessage.id,
      media_group_id: existingMessage.media_group_id
    });

    // Extract file information
    const fileId = message.photo ? message.photo[message.photo.length - 1].file_id :
      message.video ? message.video.file_id : message.document ? message.document.file_id : null;
    const fileUniqueId = message.photo ? message.photo[message.photo.length - 1].file_unique_id :
      message.video ? message.video.file_unique_id : message.document ? message.document.file_unique_id : null;

    if (!fileId || !fileUniqueId) {
      logger.error("File ID or Unique ID missing in edited message", {
        message_id: telegramMessageId,
        file_id: fileId,
        file_unique_id: fileUniqueId
      });
      return new Response(
        JSON.stringify({ error: "File ID or Unique ID missing in edited message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Process the media (download, store, etc.)
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!telegramBotToken) {
      logger.error("Telegram bot token is not set");
      return new Response(
        JSON.stringify({ error: "Telegram bot token is not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mediaProcessingResult = await xdelo_processMessageMedia(
      message,
      fileId,
      fileUniqueId,
      telegramBotToken,
      existingMessage.id,
      correlationId
    );

    if (!mediaProcessingResult.success) {
      logger.error("Media processing failed", {
        message_id: telegramMessageId,
        error: mediaProcessingResult.error
      });
      return new Response(
        JSON.stringify({ error: `Media processing failed: ${mediaProcessingResult.error}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Prepare edit history
    const editHistory = existingMessage.edit_history || [];
    let changeType: 'caption' | 'media' | 'both' = 'caption';

    if (hasCaption(message) !== hasCaption(existingMessage)) {
      changeType = 'both';
    } else {
      changeType = 'caption';
    }

    const historyEntry = prepareEditHistoryEntry(existingMessage, message, changeType);
    editHistory.push(historyEntry);

    // Step 4: Update the message
    const updateData: Record<string, any> = {
      caption: captionText,
      is_edited: true,
      edit_date: editDate,
      edit_history: editHistory,
      edit_count: (existingMessage.edit_count || 0) + 1,
      telegram_data: message,
      updated_at: new Date().toISOString(),
      file_id: fileId,
      file_unique_id: fileUniqueId,
      mime_type: mediaProcessingResult.fileInfo.mime_type,
      file_size: mediaProcessingResult.fileInfo.file_size,
      storage_path: mediaProcessingResult.fileInfo.storage_path,
      public_url: mediaProcessingResult.fileInfo.public_url,
      processing_state: 'pending', // Reset processing state to pending
      correlation_id: correlationId
    };

    const { error: updateError } = await supabaseClient
      .from('messages')
      .update(updateData)
      .eq('id', existingMessage.id);

    if (updateError) {
      logger.error("Error updating message:", updateError);
      return new Response(
        JSON.stringify({ error: `Database update error: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Message updated successfully", {
      message_id: existingMessage.id,
      has_caption: hasCaption(message)
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Edit processed successfully",
        messageId: existingMessage.id,
        hasCaption: hasCaption(message),
        mediaGroupId: existingMessage.media_group_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error handling edited media message:", error);
    return new Response(
      JSON.stringify({ error: `Error handling edited media message: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
