import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/hooks/useUser';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { LogEventType, logEvent } from "@/lib/logUtils";

interface UseSingleFileOperationsResult {
  isUploading: boolean;
  isDeleting: boolean;
  uploadFile: (file: File, storagePath?: string) => Promise<string | null>;
  deleteFile: (filePath: string) => Promise<boolean>;
}

/**
 * Hook for handling single file upload and delete operations
 */
export function useSingleFileOperations(): UseSingleFileOperationsResult {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const isMobile = useMediaQuery('(max-width: 768px)');

  /**
   * Upload a file to Supabase storage
   * @param file The file to upload
   * @param storagePath Optional storage path, defaults to user ID
   * @returns The public URL of the uploaded file, or null on failure
   */
  const uploadFile = async (file: File, storagePath?: string): Promise<string | null> => {
    setIsUploading(true);
    try {
      const userId = user?.id;
      if (!userId) {
        throw new Error("User ID not available");
      }

      const filePath = storagePath || `${userId}/${file.name}`;
      const { data, error } = await supabase.storage
        .from('message_media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new Error(`File upload failed: ${error.message}`);
      }

      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/message_media/${data.path}`;
      toast({
        title: "Upload successful",
        description: isMobile ? "File uploaded" : `File uploaded to ${data.path}`,
      });

      // Log completion of sync operation
      await logSyncCompletion(data.path, {
        fileSize: file.size,
        mimeType: file.type,
        storagePath: data.path,
        publicUrl
      });

      return publicUrl;
    } catch (error: any) {
      console.error("File upload error:", error.message);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Delete a file from Supabase storage
   * @param filePath The path of the file to delete
   * @returns True on success, false on failure
   */
  const deleteFile = async (filePath: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.storage
        .from('message_media')
        .remove([filePath]);

      if (error) {
        throw new Error(`File deletion failed: ${error.message}`);
      }

      toast({
        title: "Deletion successful",
        description: isMobile ? "File deleted" : `File deleted from ${filePath}`,
      });
      return true;
    } catch (error: any) {
      console.error("File deletion error:", error.message);
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

// Log completion of sync operation
const logSyncCompletion = async (entityId: string, details: any) => {
  try {
    await logEvent(
      LogEventType.SYNC_COMPLETED,
      entityId,
      {
        ...details,
        timestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.error("Failed to log sync completion:", error);
  }
};

  return {
    isUploading,
    isDeleting,
    uploadFile,
    deleteFile,
  };
}
