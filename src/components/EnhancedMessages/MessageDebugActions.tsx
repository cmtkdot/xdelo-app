
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  processMessageCaption, 
  syncMediaGroup, 
  reprocessMessage 
} from '@/lib/unifiedProcessor';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';
import { Message } from '@/types/entities/Message';

interface MessageDebugActionsProps {
  message: Message;
  onSuccess?: () => void;
}

export function MessageDebugActions({ message, onSuccess }: MessageDebugActionsProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  // If it's part of a media group, we need special handling
  const isPartOfMediaGroup = !!message.media_group_id;
  
  const handleReprocessCaption = async () => {
    setIsProcessing(true);
    setResult(null);
    
    try {
      const result = await processMessageCaption(message.id, true);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Caption processed successfully"
        });
        setResult(result.data);
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to process caption",
          variant: "destructive"
        });
        setResult({ error: result.error });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "An unexpected error occurred",
        variant: "destructive"
      });
      setResult({ error: (error as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSyncMediaGroup = async () => {
    if (!message.media_group_id) {
      toast({
        title: "Error",
        description: "This message is not part of a media group",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    setResult(null);
    
    try {
      const result = await syncMediaGroup(message.id, message.media_group_id, true);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Media group synced successfully: ${result.data?.updated_count || 0} messages updated`
        });
        setResult(result.data);
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to sync media group",
          variant: "destructive"
        });
        setResult({ error: result.error });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "An unexpected error occurred",
        variant: "destructive"
      });
      setResult({ error: (error as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleFullReprocess = async () => {
    setIsProcessing(true);
    setResult(null);
    
    try {
      const result = await reprocessMessage(message.id, true);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Message reprocessed successfully"
        });
        setResult(result.data);
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to reprocess message",
          variant: "destructive"
        });
        setResult({ error: result.error });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "An unexpected error occurred",
        variant: "destructive"
      });
      setResult({ error: (error as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Debug Actions</CardTitle>
        <CardDescription>
          Tools to help debug and fix message processing issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Button 
            onClick={handleReprocessCaption} 
            disabled={isProcessing}
            variant="outline"
            className="w-full"
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reprocess Caption
          </Button>
          
          {isPartOfMediaGroup && (
            <Button 
              onClick={handleSyncMediaGroup} 
              disabled={isProcessing}
              variant="outline"
              className="w-full"
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sync Media Group
            </Button>
          )}
          
          <Button 
            onClick={handleFullReprocess} 
            disabled={isProcessing}
            variant="default"
            className="w-full"
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Full Reprocess
          </Button>
        </div>
        
        {result && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Result:</h4>
            <pre className="bg-muted text-xs p-2 rounded-md overflow-auto max-h-40">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {message.processing_state === 'completed' 
          ? `Message processing completed at ${message.processing_completed_at}` 
          : `Current state: ${message.processing_state || 'unknown'}`}
      </CardFooter>
    </Card>
  );
}
