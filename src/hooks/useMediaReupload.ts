
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message } from '@/types';

export function useMediaReupload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Reupload a media file from Telegram with correct MIME type
  const xdelo_reuploadMediaFromTelegram = async (messageId: string) => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to handle the reupload
      const { data, error } = await supabase.functions.invoke(
        'repair-media',
        {
          body: { 
            action: 'reupload_from_telegram',
            messageIds: [messageId],
            options: {
              forceRedownload: true,
              updateMimeType: true,
              fixContentDisposition: true
            }
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Media Reuploaded",
        description: `Successfully reuploaded media for message ${messageId.substring(0, 8)}.`
      });
      
      return data;
    } catch (error) {
      console.error('Error reuploading media from Telegram:', error);
      
      toast({
        title: "Reupload Failed",
        description: error.message || "Failed to reupload media",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Fix MIME types for a batch of messages
  const xdelo_fixMimeTypes = async (messageIds: string[]) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-media',
        {
          body: { 
            action: 'fix_mime_types',
            messageIds,
            options: {
              updateDatabase: true,
              updateStorageMetadata: true
            }
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "MIME Types Fixed",
        description: `Fixed MIME types for ${data.updated || 0} messages.`
      });
      
      return data;
    } catch (error) {
      console.error('Error fixing MIME types:', error);
      
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix MIME types",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Check and validate file exists in storage
  const xdelo_validateFileExists = async (messageId: string) => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke(
        'repair-media',
        {
          body: { 
            action: 'validate_storage',
            messageIds: [messageId]
          }
        }
      );
      
      if (error) throw error;
      
      const exists = data.exists || false;
      
      toast({
        title: "Storage Validation",
        description: exists 
          ? "Media file exists in storage" 
          : "Media file not found in storage",
        variant: exists ? "default" : "destructive"
      });
      
      return exists;
    } catch (error) {
      console.error('Error validating file existence:', error);
      
      toast({
        title: "Validation Failed",
        description: error.message || "Failed to validate storage",
        variant: "destructive"
      });
      
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    xdelo_reuploadMediaFromTelegram,
    xdelo_fixMimeTypes,
    xdelo_validateFileExists,
    isProcessing
  };
}
