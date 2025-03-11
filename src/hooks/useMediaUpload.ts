
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

  const validateStorageFile = async (storagePath: string) => {
    try {
      return await xdelo_validateStorageFile(storagePath);
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  };

  const repairFile = async (storagePath: string, mimeType: string) => {
    try {
      const result = await xdelo_repairContentDisposition(storagePath, mimeType);
      if (result) {
        toast({
          title: "File repaired",
          description: "File content disposition has been fixed."
        });
      } else {
        toast({
          title: "Repair failed",
          description: "Could not repair the file.",
          variant: "destructive"
        });
      }
      return result;
    } catch (error) {
      console.error('Repair failed:', error);
      toast({
        title: "Repair failed",
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
