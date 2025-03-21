
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Wrench } from "lucide-react";
import type { Message } from '@/types/MessagesTypes';
import { useMediaUtils } from '@/hooks/useMediaUtils';

export interface MediaRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessages?: Message[];
  initialMessageIds?: string[];
  mediaGroupId?: string;
  messages?: Message[];
  messageIds?: string[];
  onComplete?: () => void;
}

export function MediaRepairDialog({ 
  open, 
  onOpenChange,
  initialMessages = [],
  initialMessageIds = [],
  mediaGroupId,
  messages = [],
  messageIds = [],
  onComplete
}: MediaRepairDialogProps) {
  const [repairing, setRepairing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    successful: number;
    failed: number;
    total: number;
    errorMessages?: string[];
  } | null>(null);

  const { 
    repairMediaBatch,
    standardizeStoragePaths,
    isProcessing
  } = useMediaUtils();

  // Combine message IDs from both props for backward compatibility
  const combinedMessageIds = [
    ...initialMessageIds,
    ...messageIds,
    ...(initialMessages?.map(m => m.id) || []),
    ...(messages?.map(m => m.id) || [])
  ].filter(Boolean);

  const handleRepairAll = async () => {
    if (combinedMessageIds.length === 0 && !mediaGroupId) return;
    
    try {
      setRepairing(true);
      setProgress(10);
      
      // For media group repair, we need to fetch the messages in the group first
      let messagesToRepair = combinedMessageIds;
      
      if (mediaGroupId && combinedMessageIds.length === 0) {
        // If we have a media group ID but no message IDs, we need to find all messages in this group
        // This would be handled by the mediaGroupId parameter in the actual repair function
        setProgress(30);
      }
      
      setProgress(50);
      const repairResult = await repairMediaBatch(messagesToRepair);
      
      setProgress(100);
      
      setResult({
        successful: repairResult.successful || 0,
        failed: repairResult.failed || 0,
        total: messagesToRepair.length,
        errorMessages: repairResult.error ? [repairResult.error] : undefined
      });
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error repairing media:', error);
      setResult({
        successful: 0,
        failed: combinedMessageIds.length,
        total: combinedMessageIds.length,
        errorMessages: [error.message || 'Unknown error occurred']
      });
    } finally {
      setRepairing(false);
    }
  };

  const handleStandardizePaths = async () => {
    try {
      setRepairing(true);
      setProgress(10);
      
      await standardizeStoragePaths(100);
      
      setProgress(100);
      
      if (onComplete) {
        onComplete();
      }
      
      // Close dialog after standardization
      onOpenChange(false);
    } catch (error) {
      console.error('Error standardizing paths:', error);
    } finally {
      setRepairing(false);
    }
  };

  const handleClose = () => {
    if (!repairing) {
      onOpenChange(false);
      setResult(null);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Media Repair</DialogTitle>
          <DialogDescription>
            Fix issues with media files including storage paths, MIME types, and content disposition.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {!result ? (
            <>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2 flex items-center">
                    <Wrench className="w-4 h-4 mr-2" />
                    Repair Options
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {combinedMessageIds.length > 0 
                      ? `Repair ${combinedMessageIds.length} selected media file${combinedMessageIds.length !== 1 ? 's' : ''}`
                      : mediaGroupId 
                        ? 'Repair all files in the media group'
                        : 'No media files selected for repair'}
                  </p>
                  
                  <div className="space-y-2">
                    <Button 
                      onClick={handleRepairAll} 
                      disabled={(combinedMessageIds.length === 0 && !mediaGroupId) || repairing || isProcessing}
                      className="w-full"
                    >
                      {repairing && <Spinner className="mr-2" size="sm" />}
                      Repair Selected Media
                    </Button>
                    
                    <Button 
                      onClick={handleStandardizePaths} 
                      disabled={repairing || isProcessing}
                      variant="outline" 
                      className="w-full"
                    >
                      {isProcessing && <Spinner className="mr-2" size="sm" />}
                      Verify All Storage Files
                    </Button>
                  </div>
                </div>
              </div>
              
              {repairing && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Repairing media...</p>
                  <Progress value={progress} />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${result.failed === 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-yellow-50 dark:bg-yellow-950/20'}`}>
                <h3 className="font-medium mb-2 flex items-center">
                  {result.failed === 0 ? (
                    <CheckCircle2 className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                  )}
                  Repair Results
                </h3>
                <p className="text-sm">
                  Successfully repaired {result.successful} of {result.total} files.
                  {result.failed > 0 && ` ${result.failed} files could not be repaired.`}
                </p>
                
                {result.errorMessages && result.errorMessages.length > 0 && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    <p className="font-medium">Errors:</p>
                    <ul className="list-disc pl-5 mt-1">
                      {result.errorMessages.slice(0, 3).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {result.errorMessages.length > 3 && <li>...and {result.errorMessages.length - 3} more errors</li>}
                    </ul>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
