import { MediaMessage, MediaItem } from './types.ts';

export async function downloadTelegramFile(fileId: string, botToken: string): Promise<Response> {
  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const fileInfo = await fileInfoResponse.json();

  if (!fileInfo.ok) {
    console.error("Failed to get file info:", fileInfo);
    throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`);
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
  return fetch(fileUrl);
}

export function getMediaItem(message: MediaMessage): MediaItem {
  return message.photo ? 
    message.photo[message.photo.length - 1] : 
    message.video || message.document;
}

export function hasValidCaption(message: MediaMessage): boolean {
  return Boolean(message.caption && message.caption.trim() !== '');
}