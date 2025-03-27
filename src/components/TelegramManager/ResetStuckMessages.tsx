
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Play } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';

export const ResetStuckMessages = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetResult, setResetResult] = useState<null | { reset_count: number }>(null);
  const [processResult, setProcessResult] = useState<null | { 
    total_processed: number;
    successful: number;
    failed: number;
  }>(null);
  const { toast } = useToast();

  const handleResetStuckMessages = async () => {
    try {
      setIsResetting(true);
      
      // Call the database function to reset stuck messages
      const { data, error } = await supabase.rpc('xdelo_reset_stuck_messages');
      
      if (error) {
        throw new Error(error.message);
      }
      
      setResetResult(data);
      
      toast({
        title: 'Reset Complete',
        description: `Reset ${data.reset_count} stuck messages`,
      });
    } catch (error) {
      console.error('Error resetting stuck messages:', error);
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleProcessPendingMessages = async () => {
    try {
      setIsProcessing(true);
      
      // Call the database function to process pending messages
      const { data, error } = await supabase.rpc('xdelo_process_pending_messages', {
        p_batch_size: 10
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      setProcessResult(data);
      
      toast({
        title: 'Processing Complete',
        description: `Processed ${data.total_processed} messages (${data.successful} succeeded, ${data.failed} failed)`,
      });
    } catch (error) {
      console.error('Error processing pending messages:', error);
      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Processing Utilities</CardTitle>
        <CardDescription>
          Reset stuck messages and process pending messages with captions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {resetResult && (
          <div className="bg-muted p-3 rounded-md text-sm">
            <p><span className="font-medium">Reset result:</span> {resetResult.reset_count} messages reset</p>
          </div>
        )}
        
        {processResult && (
          <div className="bg-muted p-3 rounded-md text-sm">
            <p><span className="font-medium">Processing result:</span></p>
            <ul className="list-disc list-inside">
              <li>Total processed: {processResult.total_processed}</li>
              <li>Successful: {processResult.successful}</li>
              <li>Failed: {processResult.failed}</li>
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="secondary" 
          onClick={handleResetStuckMessages}
          disabled={isResetting || isProcessing}
        >
          {isResetting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset Stuck Messages
            </>
          )}
        </Button>
        
        <Button 
          onClick={handleProcessPendingMessages}
          disabled={isResetting || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Process Pending Messages
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ResetStuckMessages;
