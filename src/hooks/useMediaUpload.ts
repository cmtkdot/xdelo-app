
import { useState } from 'react';
import { 
  xdelo_uploadTelegramMedia, 
  xdelo_validateStorageFile,
  xdelo_repairContentDisposition,
  xdelo_checkFileExistsInStorage
} from '@/lib/telegramMediaUtils';
import { useToast } from './useToast';

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Check if media already exists in storage
   */
  const checkMediaExists = async (fileUniqueId: string, extension: string): Promise<boolean> => {
    try {
      return await xdelo_checkFileExistsInStorage(fileUniqueId, extension);
    } catch (error) {
      console.error('Error checking media existence:', error);
      return false;
    }
  };

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
      // Check if media exists first (just for logging/debugging)
      const exists = await checkMediaExists(fileUniqueId, mimeType || '');
      console.log(`Media ${fileUniqueId} exists in storage: ${exists}`);
      
      // Always upload/re-upload regardless of existence
      const { publicUrl, storagePath, mimeType: detectedMimeType } = await xdelo_uploadTelegramMedia(
        fileUrl, 
        fileUniqueId, 
        mediaType, 
        mimeType
      );
      
      setLastUploadedUrl(publicUrl);
      toast({
        title: exists ? "Media updated" : "Upload successful",
        description: exists ? "Media file has been re-uploaded and replaced." : "Media file has been uploaded."
      });
      
      return { publicUrl, storagePath, mimeType: detectedMimeType };
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
   * Repair file by re-uploading with inline content disposition
   */
  const repairFile = async (storagePath: string) => {
    try {
      const result = await xdelo_repairContentDisposition(storagePath);
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
    checkMediaExists,
    isUploading,
    lastUploadedUrl
  };
}
