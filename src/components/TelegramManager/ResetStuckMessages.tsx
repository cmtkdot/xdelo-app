
import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

export function ResetStuckMessages() {
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const handleResetStuckMessages = async () => {
    setIsResetting(true);
    try {
      // Call the edge function instead of the RPC directly
      const { data, error } = await supabase.functions.invoke('utility-functions', {
        body: {
          action: 'reset_stalled_messages'
        }
      });

      if (error) throw error;

      toast({
        title: 'Stuck messages reset',
        description: 'All stuck messages have been reset to pending state.',
      });
    } catch (error) {
      console.error('Error resetting stuck messages:', error);
      toast({
        title: 'Reset failed',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Alert>
      <AlertTitle>Stuck Message Processing</AlertTitle>
      <AlertDescription>
        If messages are stuck in the "processing" state for too long, use this tool to reset them.
      </AlertDescription>
      <div className="mt-4">
        <Button 
          onClick={handleResetStuckMessages} 
          disabled={isResetting}
          variant="secondary"
        >
          {isResetting && <Spinner className="mr-2 h-4 w-4" />}
          Reset Stuck Messages
        </Button>
      </div>
    </Alert>
  );
}
