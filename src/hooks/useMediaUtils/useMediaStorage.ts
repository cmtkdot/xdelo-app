
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

/**
 * Hook for media storage operations
 */
export function useMediaStorage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Upload a media file to storage
   */
  const uploadMedia = async (
    file: File,
    options: {
      path?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<{
    data: any;
    error: any;
  }> => {
    try {
      setIsLoading(true);
      
      const { path = 'uploads', metadata = {} } = options;
      const filePath = `${path}/${crypto.randomUUID()}-${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
          duplex: 'half',
          metadata
        });
      
      if (error) {
        toast({
          title: 'Upload Failed',
          description: error.message,
          variant: 'destructive'
        });
        return { data: null, error };
      }
      
      toast({
        title: 'Upload Successful',
        description: 'File uploaded successfully'
      });
      
      return { data, error: null };
    } catch (error) {
      toast({
        title: 'Upload Error',
        description: error.message,
        variant: 'destructive'
      });
      
      return { data: null, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Download a media file from a URL
   */
  const downloadMedia = async (
    url: string,
    filename?: string
  ): Promise<{
    success: boolean;
    error?: any;
  }> => {
    try {
      setIsLoading(true);
      
      // Create an anchor element to trigger the download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || url.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return { success: true };
    } catch (error) {
      toast({
        title: 'Download Error',
        description: error.message,
        variant: 'destructive'
      });
      
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a media file from storage
   */
  const deleteMedia = async (
    path: string
  ): Promise<{
    data: any;
    error: any;
  }> => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.storage
        .from('media')
        .remove([path]);
      
      if (error) {
        toast({
          title: 'Delete Failed',
          description: error.message,
          variant: 'destructive'
        });
        return { data: null, error };
      }
      
      toast({
        title: 'Delete Successful',
        description: 'File deleted successfully'
      });
      
      return { data, error: null };
    } catch (error) {
      toast({
        title: 'Delete Error',
        description: error.message,
        variant: 'destructive'
      });
      
      return { data: null, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    uploadMedia,
    downloadMedia,
    deleteMedia,
    isLoading
  };
}
