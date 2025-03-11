
import { useState } from 'react';
import { useToast } from './useToast';
import { xdelo_checkFileExistsInStorage } from '@/lib/telegramMediaUtils';

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Check if media exists in storage
   */
  const checkMediaExists = async (fileUniqueId: string, mimeType: string): Promise<boolean> => {
    try {
      return await xdelo_checkFileExistsInStorage(fileUniqueId, mimeType);
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  };

  /**
   * Upload media to storage
   */
  const uploadMedia = async (fileUrl: string, fileUniqueId: string) => {
    setIsUploading(true);
    try {
      // Get the file data
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Failed to fetch media');
      const fileData = await response.blob();

      // Construct storage path using fileUniqueId, let Supabase determine extension
      const extension = fileData.type.split('/')[1] || 'bin';
      const storagePath = `${fileUniqueId}.${extension}`;
      
      // Upload to storage with upsert enabled, let Supabase handle content type
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
    checkMediaExists,
    isUploading,
    lastUploadedUrl
  };
}
