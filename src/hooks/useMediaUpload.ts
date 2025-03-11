
import { useState } from 'react';
import { 
  xdelo_uploadTelegramMedia, 
  xdelo_validateStorageFile,
  xdelo_repairContentDisposition
} from '@/lib/telegramMediaUtils';
import { useToast } from './useToast';

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Upload media to storage
   * Always re-uploads media even if it already exists, replacing the existing file
   */
  const uploadMedia = async (
    fileUrl: string, 
    fileUniqueId: string, 
    mediaType: string, 
    mimeType?: string
  ) => {
    setIsUploading(true);
    try {
      const { publicUrl, storagePath } = await xdelo_uploadTelegramMedia(
        fileUrl, 
        fileUniqueId, 
        mediaType, 
        mimeType
      );
      
      setLastUploadedUrl(publicUrl);
      toast({
        title: "Upload successful",
        description: "Media file has been uploaded and replaced if it existed."
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

  /**
   * Validate if a file exists in storage
   */
  const validateStorageFile = async (storagePath: string) => {
    try {
      return await xdelo_validateStorageFile(storagePath);
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  };

  /**
   * Repair file by re-uploading with correct content type
   */
  const repairFile = async (storagePath: string, mimeType: string) => {
    try {
      const result = await xdelo_repairContentDisposition(storagePath, mimeType);
      if (result) {
        toast({
          title: "File updated",
          description: "File has been re-uploaded with correct content type."
        });
      } else {
        toast({
          title: "Update failed",
          description: "Could not update the file.",
          variant: "destructive"
        });
      }
      return result;
    } catch (error) {
      console.error('File update failed:', error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    uploadMedia,
    validateStorageFile,
    repairFile,
    isUploading,
    lastUploadedUrl
  };
}
