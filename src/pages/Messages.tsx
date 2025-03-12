
import React, { useState } from 'react';
import { MessageListContainer } from '../components/Messages/MessageListContainer';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ProcessingState } from '@/types';

export default function MessagesPage() {
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const handleBatchReanalyze = async () => {
    try {
      setIsReanalyzing(true);
      const toastId = toast.loading('Preparing to reanalyze messages with captions...');
      
      // Fetch messages with captions that need reanalysis
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, caption')
        .not('caption', 'is', null)
        .in('processing_state', ['error', 'pending'] as ProcessingState[])
        .limit(30); // Limit to prevent excessive processing
      
      if (error) throw error;
      
      if (!messages || messages.length === 0) {
        toast.error('No messages with captions found to reanalyze');
        toast.dismiss(toastId);
        setIsReanalyzing(false);
        return;
      }
      
      toast.loading(`Reanalyzing ${messages.length} messages...`, { id: toastId });
      
      // Process each message
      let successCount = 0;
      let errorCount = 0;
      
      await Promise.all(messages.map(async (message) => {
        try {
          // Set messages to pending state
          await supabase
            .from('messages')
            .update({
              processing_state: 'pending' as ProcessingState,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
            
          // Call direct processor
          await supabase.functions.invoke('direct-caption-processor', {
            body: { messageId: message.id, force_reprocess: true }
          });
          
          successCount++;
        } catch (err) {
          console.error(`Failed to reanalyze message ${message.id}:`, err);
          errorCount++;
        }
      }));
      
      toast.success(`Reanalyzed ${successCount} messages successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`, { id: toastId });
      
      // Wait 2 seconds before allowing another reanalysis
      setTimeout(() => {
        setIsReanalyzing(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error during batch reanalysis:', error);
      toast.error('Failed to reanalyze messages');
      setIsReanalyzing(false);
    }
  };

  return (
    <div className="container mx-auto">
      <Helmet>
        <title>Message Queue | Telegram Processing</title>
      </Helmet>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Message Processing Queue</h1>
        
        <Button 
          variant="outline" 
          onClick={handleBatchReanalyze}
          disabled={isReanalyzing}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Batch Reanalyze Messages
        </Button>
      </div>
      
      <div className="space-y-6">
        <MessageListContainer />
      </div>
    </div>
  );
}
