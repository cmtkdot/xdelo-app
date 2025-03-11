
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export function useMessageAnalysis() {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Directly trigger analysis for a specific message
  const handleReanalyze = async (message: any) => {
    if (isProcessing[message.id]) return;
    
    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      setErrors(prev => ({ ...prev, [message.id]: '' }));
      
      console.log('Requesting direct analysis for message:', message.id);
      
      // Validate required fields
      if (!message.id) {
        throw new Error('Message ID is required for analysis');
      }
      
      if (!message.caption) {
        throw new Error('Message caption is required for analysis');
      }
      
      // Generate a correlation ID as a string
      const correlationId = crypto.randomUUID();
      
      // Log analysis start
      console.log(`Starting analysis for message ${message.id} with correlation ID ${correlationId}`);
      
      // Call parse-caption-with-ai directly for immediate processing
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        'parse-caption-with-ai',
        {
          body: { 
            messageId: message.id, 
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId, 
            isEdit: false,
            retryCount: 0
          }
        }
      );
      
      if (analysisError) {
        throw new Error(analysisError.message || 'Analysis failed');
      }
      
      console.log('Analysis result:', analysisData);
      
      // If this is part of a media group, force sync the content to other messages immediately
      if (message.media_group_id) {
        try {
          console.log(`Forcing direct sync for media group ${message.media_group_id}`);
          
          const { data: syncData, error: syncError } = await supabase.functions.invoke(
            'xdelo_sync_media_group',
            {
              body: {
                mediaGroupId: message.media_group_id,
                sourceMessageId: message.id,
                correlationId,
                forceSync: true,
                syncEditHistory: true
              }
            }
          );
          
          if (syncError) {
            console.warn('Media group sync warning:', syncError);
          } else {
            console.log('Media group sync result:', syncData);
          }
        } catch (syncError) {
          console.warn('Media group sync error (non-fatal):', syncError);
        }
      }
      
      toast({
        title: "Analysis Complete",
        description: "The message has been analyzed successfully."
      });
      
      return analysisData?.data;
      
    } catch (error: any) {
      console.error('Error analyzing message:', error);
      
      // Set detailed error message
      const errorMessage = error.message || 'Failed to analyze message';
      setErrors(prev => ({ 
        ...prev, 
        [message.id]: errorMessage
      }));
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  return {
    handleReanalyze,
    isProcessing,
    errors
  };
}
