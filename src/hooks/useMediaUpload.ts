
import { useState } from 'react';
import { useToast } from './useToast';

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const uploadMedia = async (
    fileUrl: string, 
    fileUniqueId: string, 
    extension: string
  ) => {
    setIsUploading(true);
    try {
      // Get the file data
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch media');
      const fileData = await response.blob();

      // Construct storage path using just fileUniqueId and extension
      const storagePath = `${fileUniqueId}.${extension}`;
      
      // Upload/replace in storage with upsert
      const result = await fetch('/functions/v1/media-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          fileData: fileData,
          storagePath,
          upsert: true // Enable overwriting existing files
        })
      });

      const { publicUrl } = await result.json();
      
      setLastUploadedUrl(publicUrl);
      toast({
        title: "Media updated",
        description: "Media file has been uploaded successfully."
      });
      
      return { publicUrl, storagePath };
    } catch (error) {
      console.error('Upload failed:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadMedia,
    isUploading,
    lastUploadedUrl
  };
}
