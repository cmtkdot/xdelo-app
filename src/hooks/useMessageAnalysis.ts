
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
      
      // Generate a correlation ID as a string
      const correlationId = crypto.randomUUID().toString();
      
      // Log analysis start
      console.log(`Starting analysis for message ${message.id} with correlation ID ${correlationId}`);
      
      // Call database function directly instead of edge function
      const { data: analysisData, error: analysisError } = await supabase.rpc(
        'xdelo_process_caption_workflow',
        { 
          p_message_id: message.id,
          p_correlation_id: correlationId,
          p_force: true
        }
      );
      
      if (analysisError) {
        throw new Error(analysisError.message || 'Analysis failed');
      }
      
      console.log('Analysis result:', analysisData);
      
      toast({
        title: "Analysis Complete",
        description: "The message has been analyzed successfully."
      });
      
      // Fetch updated message data
      const { data: updatedMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('id', message.id)
        .single();
      
      return updatedMessage?.analyzed_content;
      
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
