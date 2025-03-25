
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { Message } from '@/types/entities/Message';

export function useSingleFileOperations() {
  const { toast } = useToast();

  /**
   * Fix content disposition for a single file
   */
  const fixContentDisposition = async (message: Message): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> => {
    try {
      if (!message.id) {
        return {
          success: false,
          message: 'Message ID is required'
        };
      }

      const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
        body: { messageId: message.id }
      });

      if (error) {
        console.error('Error fixing content disposition:', error);
        toast({
          title: 'Error',
          description: `Failed to fix content disposition: ${error.message}`,
          variant: 'destructive',
        });
        return {
          success: false,
          message: error.message || 'Failed to fix content disposition'
        };
      }

      toast({
        title: 'Success',
        description: 'Content disposition fixed successfully',
      });

      return {
        success: true,
        message: 'Content disposition fixed successfully',
        data
      };
    } catch (error: any) {
      console.error('Exception in fixContentDisposition:', error);
      toast({
        title: 'Error',
        description: `An unexpected error occurred: ${error.message}`,
        variant: 'destructive',
      });
      return {
        success: false,
        message: error.message || 'An unexpected error occurred'
      };
    }
  };

  /**
   * Reupload media from Telegram for a single file
   */
  const reuploadMediaFromTelegram = async (message: Message): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> => {
    try {
      if (!message.id) {
        return {
          success: false,
          message: 'Message ID is required'
        };
      }

      const { data, error } = await supabase.functions.invoke('xdelo_reupload_media', {
        body: { 
          messageId: message.id,
          forceRedownload: true 
        }
      });

      if (error) {
        console.error('Error reuploading media from Telegram:', error);
        toast({
          title: 'Error',
          description: `Failed to reupload media: ${error.message}`,
          variant: 'destructive',
        });
        return {
          success: false,
          message: error.message || 'Failed to reupload media from Telegram'
        };
      }

      toast({
        title: 'Success',
        description: 'Media successfully reuploaded from Telegram',
      });

      return {
        success: true,
        message: 'Media successfully reuploaded from Telegram',
        data
      };
    } catch (error: any) {
      console.error('Exception in reuploadMediaFromTelegram:', error);
      toast({
        title: 'Error',
        description: `An unexpected error occurred: ${error.message}`,
        variant: 'destructive',
      });
      return {
        success: false,
        message: error.message || 'An unexpected error occurred'
      };
    }
  };

  /**
   * Reanalyze caption for a message
   */
  const reanalyzeCaption = async (message: Message): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> => {
    try {
      if (!message.id) {
        return {
          success: false,
          message: 'Message ID is required'
        };
      }

      if (!message.caption) {
        return {
          success: false,
          message: 'Message has no caption to analyze'
        };
      }

      // Generate a correlation ID
      const correlationId = crypto.randomUUID().toString();

      // Call database function directly 
      const { data, error } = await supabase.rpc(
        'xdelo_process_caption_workflow',
        {
          p_message_id: message.id,
          p_correlation_id: correlationId,
          p_force: true
        }
      );

      if (error) {
        console.error('Error analyzing caption:', error);
        toast({
          title: 'Error',
          description: `Failed to analyze caption: ${error.message}`,
          variant: 'destructive',
        });
        return {
          success: false,
          message: error.message || 'Failed to analyze caption'
        };
      }

      toast({
        title: 'Success',
        description: 'Caption analyzed successfully',
      });

      return {
        success: true,
        message: 'Caption analyzed successfully',
        data
      };
    } catch (error: any) {
      console.error('Error in reanalyzeCaption:', error);
      toast({
        title: 'Error',
        description: `An unexpected error occurred: ${error.message}`,
        variant: 'destructive',
      });
      return {
        success: false,
        message: error.message || 'An unexpected error occurred'
      };
    }
  };

  return {
    fixContentDisposition,
    reuploadMediaFromTelegram,
    reanalyzeCaption
  };
}
