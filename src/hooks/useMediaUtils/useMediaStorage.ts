import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

/**
 * Hook for media storage operations
 */
export function useMediaStorage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  /**
   * Upload a media file to storage
   */
  const uploadMedia = async (
    file: File,
    options: {
      path?: string;
      contentType?: string;
      onProgress?: (progress: number) => void;
    } = {}
  ) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Generate a storage path if not provided
      const storagePath = options.path || `uploads/${crypto.randomUUID()}/${file.name}`;
      
      // Upload the file with progress tracking
      const { data, error } = await supabase.storage
        .from('media')
        .upload(storagePath, file, {
          contentType: options.contentType || file.type,
          cacheControl: '3600',
          upsert: false,
          // Handle progress manually since onUploadProgress isn't in FileOptions
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(storagePath);
      
      return {
        success: true,
        url: publicUrlData.publicUrl,
        path: storagePath
      };
    } catch (error) {
      console.error('Error uploading media:', error);
      
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Download a media file from a URL
   */
  const downloadMedia = async (url: string, filename?: string) => {
    try {
      // Fetch the file
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      // Get the blob
      const blob = await response.blob();
      
      // Create a download link
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || url.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      
      return { success: true };
    } catch (error) {
      console.error('Error downloading media:', error);
      
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  /**
   * Delete a media file from storage
   */
  const deleteMedia = async (path: string) => {
    try {
      const { error } = await supabase.storage
        .from('media')
        .remove([path]);
      
      if (error) throw error;
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting media:', error);
      
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  return {
    uploadMedia,
    downloadMedia,
    deleteMedia,
    isUploading,
    uploadProgress
  };
}
