
export const extractMediaInfo = (message: any) => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null
  const video = message.video
  const document = message.document

  if (photo) {
    return {
      file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      mime_type: 'image/jpeg',
      file_size: photo.file_size,
      width: photo.width,
      height: photo.height
    }
  }

  if (video) {
    return {
      file_id: video.file_id,
      file_unique_id: video.file_unique_id,
      mime_type: video.mime_type,
      file_size: video.file_size,
      width: video.width,
      height: video.height,
      duration: video.duration
    }
  }

  if (document && document.mime_type?.startsWith('image/')) {
    return {
      file_id: document.file_id,
      file_unique_id: document.file_unique_id,
      mime_type: document.mime_type,
      file_size: document.file_size
    }
  }

  return null
}
