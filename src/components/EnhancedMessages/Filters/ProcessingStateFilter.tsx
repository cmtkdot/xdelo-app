
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, PlayCircle, AlertCircle } from 'lucide-react';
import { ProcessingState } from '@/types';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';

interface ProcessingStateFilterProps {
  processingStates: ProcessingState[];
  setProcessingStates: (states: ProcessingState[]) => void;
}

export function ProcessingStateFilter({ 
  processingStates = [], 
  setProcessingStates 
}: ProcessingStateFilterProps) {
  // Ensure processingStates is always an array
  const safeProcessingStates = Array.isArray(processingStates) ? processingStates : [];
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const processingStateOptions: ProcessingState[] = [
    'completed', 'processing', 'error', 'pending', 'initialized'
  ];
  
  const handleForceProcessing = async () => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('force-processing', {
        body: { 
          limit: 20,
          detailedLogs: true
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (data.processed_count === 0 && data.failed_count === 0) {
        toast({
          title: 'No messages to process',
          description: 'No pending messages found that require processing',
        });
      } else {
        toast({
          title: 'Processing Triggered',
          description: `Processed ${data.processed_count} messages, ${data.failed_count} failed`,
          variant: data.failed_count > 0 ? 'destructive' : 'default',
        });
      }
    } catch (err) {
      console.error('Error forcing processing:', err);
      toast({
        title: 'Processing Failed',
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Processing State</Label>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleForceProcessing}
          disabled={isProcessing}
          className="flex items-center gap-1 text-xs"
        >
          {isProcessing ? (
            <>
              <AlertCircle className="h-3 w-3" />
              Processing...
            </>
          ) : (
            <>
              <PlayCircle className="h-3 w-3" />
              Force Process Pending
            </>
          )}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {processingStateOptions.map((state) => (
          <Badge
            key={state}
            variant={safeProcessingStates.includes(state) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => {
              setProcessingStates(
                safeProcessingStates.includes(state)
                  ? safeProcessingStates.filter((s) => s !== state)
                  : [...safeProcessingStates, state]
              );
            }}
          >
            {state}
            {safeProcessingStates.includes(state) && (
              <X className="ml-1 h-3 w-3" />
            )}
          </Badge>
        ))}
      </div>
    </div>
  );
}
