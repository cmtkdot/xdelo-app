import { createEdgeHandler, HandlerContext, createErrorResponse, createSuccessResponse } from '../_shared/edgeHandler.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';

interface DeleteMessageRequest {
  messageId: string;
  deleteFromTelegram?: boolean;
}

const handleDeleteMessage = createEdgeHandler(async (req: Request, context: HandlerContext) => {
  try {
    const { logger, correlationId } = context;
    
    const { messageId, deleteFromTelegram = false } = await req.json() as DeleteMessageRequest;
    
    if (!messageId) {
      return createErrorResponse('Missing messageId parameter', 400, correlationId);
    }
    
    logger.info(`Processing delete request for message ${messageId}`, {
      delete_from_telegram: deleteFromTelegram,
    });
    
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (fetchError) {
      logger.error(`Error fetching message: ${fetchError.message}`, { messageId });
      return createErrorResponse(`Error fetching message: ${fetchError.message}`, 404, correlationId);
    }
    
    if (!message) {
      return createErrorResponse('Message not found', 404, correlationId);
    }
    
    try {
      await xdelo_logProcessingEvent(
        'message_deleted',
        messageId,
        correlationId,
        {
          delete_from_telegram: deleteFromTelegram,
          file_unique_id: message.file_unique_id,
          media_group_id: message.media_group_id,
          operation_type: deleteFromTelegram ? 'permanent_deletion' : 'database_deletion'
        }
      );
    } catch (logError) {
      logger.error(`Error logging deletion: ${logError}`, { messageId });
    }
    
    if (deleteFromTelegram && message.telegram_message_id && message.chat_id) {
      try {
        const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        
        if (!botToken) {
          logger.error('TELEGRAM_BOT_TOKEN not found in environment', {});
          return createErrorResponse('Missing Telegram bot token', 500, correlationId);
        }
        
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/deleteMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: message.chat_id,
              message_id: message.telegram_message_id
            })
          }
        );
        
        const telegramResult = await telegramResponse.json();
        
        if (!telegramResult.ok) {
          logger.error(`Telegram API error: ${telegramResult.description}`, { telegramResult });
          
          if (telegramResult.description.includes('message to delete not found')) {
            logger.info('Message already deleted on Telegram, continuing with database deletion', {});
          } else {
            return createErrorResponse(`Telegram deletion failed: ${telegramResult.description}`, 400, correlationId);
          }
        }
        
        logger.info('Successfully deleted message from Telegram', {
          chat_id: message.chat_id,
          message_id: message.telegram_message_id
        });
      } catch (telegramError) {
        logger.error(`Error calling Telegram API: ${telegramError.message}`, { telegramError });
        return createErrorResponse(`Error calling Telegram API: ${telegramError.message}`, 500, correlationId);
      }
    }
    
    if (deleteFromTelegram) {
      const { error: deleteError } = await supabaseClient
        .from('messages')
        .delete()
        .eq('id', messageId);
        
      if (deleteError) {
        logger.error(`Error deleting message from database: ${deleteError.message}`, { deleteError });
        return createErrorResponse(`Error deleting message: ${deleteError.message}`, 500, correlationId);
      }
    } else {
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          deleted_from_telegram: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
        
      if (updateError) {
        logger.error(`Error marking message as deleted: ${updateError.message}`, { updateError });
        return createErrorResponse(`Error marking message as deleted: ${updateError.message}`, 500, correlationId);
      }
    }
    
    logger.success(`Message ${deleteFromTelegram ? 'permanently deleted' : 'marked as deleted'}`, { messageId });
    
    return createSuccessResponse({
      success: true,
      messageId,
      operation: deleteFromTelegram ? 'permanent_deletion' : 'database_deletion'
    }, `Message successfully ${deleteFromTelegram ? 'deleted' : 'marked as deleted'}`);
    
  } catch (error) {
    context.logger.error(`Unexpected error handling message deletion:`, { error });
    return createErrorResponse(
      `Unexpected error: ${error.message || 'Unknown error'}`,
      500,
      context.correlationId
    );
  }
});

Deno.serve(handleDeleteMessage);
