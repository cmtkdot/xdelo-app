
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
      
      // Use a different approach with Supabase functions instead of direct RPC
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
        'process-caption', 
        { 
          body: { 
            messageId: message.id,
            correlationId: correlationId,
            force: true
          }
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
      
      return { 
        success: true, 
        message: updatedMessage 
      };
    } catch (error: any) {
      console.error('Analysis error:', error);
      
      setErrors(prev => ({ 
        ...prev, 
        [message.id]: error.message || 'Unknown error' 
      }));
      
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze message",
        variant: "destructive"
      });
      
      return { 
        success: false, 
        error: error.message 
      };
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
