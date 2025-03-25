
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/entities/Message';

export interface FileUploadParams {
  file: File;
  messageId?: string;
  metadata?: Record<string, any>;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  error?: string;
  data?: any;
}

/**
 * Hook for handling single file operations
 */
export function useSingleFileOperations() {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  /**
   * Upload a file to storage
   */
  const uploadFile = useCallback(async (params: FileUploadParams): Promise<FileOperationResult> => {
    const { file, messageId, metadata = {} } = params;
    
    try {
      setIsUploading(true);
      
      // Generate a unique file path
      const filePath = `uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Upload the file to storage
      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
          metadata
        });
        
      if (error) {
        console.error('Error uploading file:', error);
        return {
          success: false,
          message: 'Failed to upload file',
          error: error.message
        };
      }
      
      // Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);
        
      // Update message if messageId is provided
      if (messageId) {
        await supabase
          .from('messages')
          .update({
            storage_path: filePath,
            public_url: publicUrlData.publicUrl,
            mime_type: file.type,
            file_size: file.size,
            storage_exists: true,
            storage_metadata: {
              uploaded_by: 'user',
              original_filename: file.name,
              upload_timestamp: new Date().toISOString(),
              ...metadata
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
      
      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          path: filePath,
          publicUrl: publicUrlData.publicUrl
        }
      };
      
    } catch (error) {
      console.error('Error in uploadFile:', error);
      return {
        success: false,
        message: 'An error occurred during file upload',
        error: error.message
      };
    } finally {
      setIsUploading(false);
    }
  }, []);
  
  /**
   * Delete a file from storage
   */
  const deleteFile = useCallback(async (storagePath: string, messageId?: string): Promise<FileOperationResult> => {
    try {
      setIsDeleting(true);
      
      // Delete the file from storage
      const { error } = await supabase.storage
        .from('media')
        .remove([storagePath]);
        
      if (error) {
        console.error('Error deleting file:', error);
        return {
          success: false,
          message: 'Failed to delete file from storage',
          error: error.message
        };
      }
      
      // Update message if messageId is provided
      if (messageId) {
        await supabase
          .from('messages')
          .update({
            storage_exists: false,
            public_url: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
      
      return {
        success: true,
        message: 'File deleted successfully'
      };
      
    } catch (error) {
      console.error('Error in deleteFile:', error);
      return {
        success: false,
        message: 'An error occurred during file deletion',
        error: error.message
      };
    } finally {
      setIsDeleting(false);
    }
  }, []);
  
  /**
   * Request Telegram to reupload media for a message
   */
  const reuploadMediaFromTelegram = useCallback(async (message: Message): Promise<FileOperationResult> => {
    try {
      console.log('Requesting media reupload from Telegram for message:', message.id);
      
      // Call the Edge Function to handle reuploading
      const { data, error } = await supabase.functions.invoke('xdelo_reupload_media', {
        body: { 
          messageId: message.id,
          forceRedownload: true 
        }
      });
      
      if (error) {
        console.error('Error in reupload request:', error);
        return {
          success: false,
          message: 'Failed to request media reupload',
          error: error.message
        };
      }
      
      return {
        success: true,
        message: 'Media reupload has been requested successfully',
        data
      };
      
    } catch (error) {
      console.error('Error in reuploadMediaFromTelegram:', error);
      return {
        success: false,
        message: 'An error occurred while requesting media reupload',
        error: error.message
      };
    }
  }, []);
  
  return {
    isUploading,
    isDeleting,
    uploadFile,
    deleteFile,
    reuploadMediaFromTelegram
  };
}
