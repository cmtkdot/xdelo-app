import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { withRetry } from './utils';

/**
 * Hook for single file media operations
 */
export function useSingleFileOperations() {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  /**
   * Upload a file to storage
   */
  const uploadFile = async (file: File, path: string): Promise<{ path: string; url: string } | null> => {
    try {
      setIsUploading(true);
      
      const { data, error } = await withRetry(
        () => supabase.storage.from('media').upload(path, file, {
          cacheControl: '3600',
          upsert: true
        }),
        { 
          maxAttempts: 3,
          delay: 1000,
          retryableErrors: ['timeout', 'connection', 'network']
        }
      );
      
      if (error) {
        console.error('Error uploading file:', error);
        toast({
          title: 'Upload Failed',
          description: error.message,
          variant: 'destructive',
        });
        return null;
      }
      
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path);
      
      return {
        path: data.path,
        url: urlData.publicUrl
      };
    } catch (err) {
      console.error('Error in uploadFile:', err);
      toast({
        title: 'Upload Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };
  
  /**
   * Delete a file from storage
   */
  const deleteFile = async (path: string): Promise<boolean> => {
    try {
      setIsDeleting(true);
      
      const { error } = await supabase.storage.from('media').remove([path]);
      
      if (error) {
        console.error('Error deleting file:', error);
        toast({
          title: 'Delete Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'File Deleted',
        description: 'Media file was successfully deleted',
      });
      
      return true;
    } catch (err) {
      console.error('Error in deleteFile:', err);
      toast({
        title: 'Delete Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  };
  
  /**
   * Reupload media from Telegram
   */
  const reuploadMediaFromTelegram = async (messageId: string): Promise<boolean> => {
    try {
      setIsUploading(true);
      
      // Call edge function to handle reupload process
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'reupload',
          messageId 
        }
      });
      
      if (error) {
        console.error('Error reuploading from Telegram:', error);
        toast({
          title: 'Reupload Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Media Reuploaded',
        description: data.message || 'Successfully reuploaded media from Telegram',
      });
      
      return true;
    } catch (err) {
      console.error('Error in reuploadMediaFromTelegram:', err);
      toast({
        title: 'Reupload Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsUploading(false);
    }
  };
  
  return {
    isUploading,
    isDeleting,
    uploadFile,
    deleteFile,
    reuploadMediaFromTelegram
  };
}
