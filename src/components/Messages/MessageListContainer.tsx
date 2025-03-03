
import React, { useState, useEffect } from 'react';
import { MessageList } from './MessageList';
import { supabase } from '@/integrations/supabase/client';
import { ProcessingState, Message, FilterValues } from '@/types';
import { useMessageProcessing } from '@/hooks/useMessageProcessing';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export const MessageListContainer: React.FC<{ filters?: FilterValues }> = ({ filters }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);
  const { handleReanalyze, processMessageQueue } = useMessageProcessing();
  const { toast } = useToast();

  const fetchMessages = async () => {
    setLoading(true);
    try {
      // Prepare query based on filters
      let query = supabase
        .from('messages')
        .select()
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Apply search filter if exists
      if (filters?.search) {
        query = query.or(`caption.ilike.%${filters.search}%,analyzed_content->product_name.ilike.%${filters.search}%,analyzed_content->product_code.ilike.%${filters.search}%`);
      }
      
      // Apply date range filter if exists
      if (filters?.dateRange?.from && filters?.dateRange?.to) {
        const fromDate = filters.dateRange.from.toISOString();
        const toDate = filters.dateRange.to.toISOString();
        query = query.gte('created_at', fromDate).lte('created_at', toDate);
      }
      
      // Apply processing state filter if exists
      if (filters?.processingState && filters.processingState.length > 0) {
        query = query.in('processing_state', filters.processingState);
      }
      
      // Apply vendor filter if exists
      if (filters?.vendors && filters.vendors.length > 0) {
        let vendorFilter = '';
        filters.vendors.forEach((vendor, index) => {
          if (index > 0) vendorFilter += ',';
          vendorFilter += `analyzed_content->vendor_uid.eq.${vendor}`;
        });
        query = query.or(vendorFilter);
      }
      
      // Execute query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to fetch messages. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle processing all pending messages
  const handleProcessAll = async () => {
    setProcessingAll(true);
    try {
      // First, find and queue unprocessed messages
      const { data: queueData, error: queueError } = await supabase.functions.invoke(
        'process-unanalyzed-messages',
        { body: { limit: 20 } }
      );
      
      if (queueError) throw queueError;
      
      toast({
        title: "Processing Complete",
        description: `Queued ${queueData?.queued || 0} messages. Processed ${queueData?.processed || 0} successfully with ${queueData?.failed || 0} failures.`,
      });
      
      // Refresh the message list
      await fetchMessages();
    } catch (error: any) {
      console.error('Error processing all messages:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "An error occurred while processing messages",
        variant: "destructive"
      });
    } finally {
      setProcessingAll(false);
    }
  };
  
  useEffect(() => {
    fetchMessages();
  }, [filters]);

  // Subscribe to messages table changes
  useEffect(() => {
    const subscription = supabase
      .channel('messages_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-4">
        <h1 className="text-2xl font-bold">Telegram Messages</h1>
        <Button 
          onClick={handleProcessAll} 
          disabled={processingAll}
          variant="outline"
        >
          {processingAll ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Process All Messages"
          )}
        </Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <MessageList 
          messages={messages} 
          onRefresh={fetchMessages} 
          onReanalyze={handleReanalyze}
        />
      )}
    </div>
  );
};
