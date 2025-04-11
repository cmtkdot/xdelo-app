import { TelegramMessage } from './types';
import { logWithCorrelation } from './utils/logger';
import { createMessageRecord, updateMessageRecord } from './utils/dbOperations';
import { isVideoMessage, getVideoMetadata } from '../_shared/mediaUtils';
import { logProcessingEvent } from './utils/dbOperations';

export const handleMediaMessage = async (
  supabase: SupabaseClient<Database>,
  message: TelegramMessage,
  correlationId: string
): Promise<void> => {
  logWithCorrelation(correlationId, `Handling media message from ${message.from.id}`);

  const videoMetadata = isVideoMessage(message) ? await getVideoMetadata(message) : null;
  const messageRecord = await createMessageRecord(supabase, message, videoMetadata);

  if (message.forward_from) {
    await updateMessageRecord(supabase, messageRecord.id, {
      forwarded_from_id: message.forward_from.id,
    });
  }

  await logProcessingEvent(supabase, messageRecord.id, 'media_message', correlationId);
};