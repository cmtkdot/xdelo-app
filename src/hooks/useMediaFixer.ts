
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMediaFixer() {
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();

  /**
   * Fix content type for a media file
   */
  const fixMediaContentType = async (storagePath: string): Promise<boolean> => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'repair',
          storagePath 
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "Media repaired",
          description: "Content type has been fixed to enable inline viewing."
        });
        return true;
      } else {
        toast({
          title: "Repair failed",
          description: data.error || "Could not repair media content type",
          variant: "destructive"
        });
        return false;
      }
    } catch (error: any) {
      console.error('Error fixing media content type:', error);
      toast({
        title: "Repair failed",
        description: error.message || "An unknown error occurred",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsRepairing(false);
    }
  };

  /**
   * Redownload a media file from Telegram
   */
  const redownloadMedia = async (messageId: string): Promise<boolean> => {
    try {
      setIsRepairing(true);
      
      const { data, error } = await supabase.functions.invoke('redownload-missing-files', {
        body: { 
          messageIds: [messageId]
        }
      });
      
      if (error) throw error;
      
      if (data.success && data.results && data.results.length > 0) {
        toast({
          title: "Media redownloaded",
          description: "Media file has been redownloaded from Telegram."
        });
        return true;
      } else {
        toast({
          title: "Redownload failed",
          description: "Could not redownload media from Telegram",
          variant: "destructive"
        });
        return false;
      }
    } catch (error: any) {
      console.error('Error redownloading media:', error);
      toast({
        title: "Redownload failed",
        description: error.message || "An unknown error occurred",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    fixMediaContentType,
    redownloadMedia,
    isRepairing
  };
}
