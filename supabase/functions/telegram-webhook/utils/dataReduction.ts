/**
 * Reduces the size of a Telegram message object by extracting only essential fields
 * to prevent PostgreSQL stack depth errors when storing in the database
 */ export function reduceTelegramMessageSize(message) {
  if (!message) return null;
  // Extract basic message properties
  const result = {
    message_id: message.message_id,
    date: message.date
  };
  // Add chat info (simplified)
  if (message.chat) {
    result.chat = {
      id: message.chat.id,
      type: message.chat.type,
      title: message.chat.title,
      username: message.chat.username
    };
  }
  // Add sender info if available (simplified)
  if (message.from) {
    result.from = {
      id: message.from.id,
      is_bot: message.from.is_bot,
      first_name: message.from.first_name,
      username: message.from.username
    };
  }
  // Add essential content fields
  if (message.text) {
    result.text = message.text;
  }
  if (message.caption) {
    result.caption = message.caption;
  }
  // Add media group ID if present
  if (message.media_group_id) {
    result.media_group_id = message.media_group_id;
  }
  // Add essential fields for different media types
  if (message.photo) {
    // Only include the largest photo (last in array) with essential fields
    const photo = message.photo[message.photo.length - 1];
    result.photo = [
      {
        file_id: photo.file_id,
        file_unique_id: photo.file_unique_id,
        width: photo.width,
        height: photo.height,
        file_size: photo.file_size
      }
    ];
  }
  if (message.video) {
    result.video = {
      file_id: message.video.file_id,
      file_unique_id: message.video.file_unique_id,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      mime_type: message.video.mime_type,
      file_size: message.video.file_size
    };
  }
  if (message.document) {
    result.document = {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      file_name: message.document.file_name,
      mime_type: message.document.mime_type,
      file_size: message.document.file_size
    };
  }
  // Essential for edits
  if (message.edit_date) {
    result.edit_date = message.edit_date;
  }
  // Essential for forwards
  if (message.forward_date) {
    result.forward_date = message.forward_date;
    if (message.forward_from) {
      result.forward_from = {
        id: message.forward_from.id,
        is_bot: message.forward_from.is_bot,
        first_name: message.forward_from.first_name,
        username: message.forward_from.username
      };
    }
    if (message.forward_from_chat) {
      result.forward_from_chat = {
        id: message.forward_from_chat.id,
        type: message.forward_from_chat.type,
        title: message.forward_from_chat.title,
        username: message.forward_from_chat.username
      };
    }
  }
  return result;
}
