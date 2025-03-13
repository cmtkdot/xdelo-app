
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, Wrench } from "lucide-react";
import type { Message } from '@/types/MessagesTypes';
import { useMediaOperations } from '@/hooks/useMediaOperations';

interface MediaRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessages?: Message[];
  initialMessageIds?: string[];
  onComplete?: () => void;
}

export function MediaRepairDialog({ 
  open, 
  onOpenChange,
  initialMessages = [],
  initialMessageIds = [],
  onComplete
}: MediaRepairDialogProps) {
  const [repairing, setRepairing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    successful: number;
    failed: number;
    total: number;
    errors?: string[];
  } | null>(null);

  const { 
    repairAllIssues,
    standardizeStoragePaths,
    isProcessing
  } = useMediaOperations();

  // Combine message IDs from both props
  const messageIds = [
    ...initialMessageIds,
    ...(initialMessages?.map(m => m.id) || [])
  ].filter(Boolean);

  const handleRepairAll = async () => {
    if (messageIds.length === 0) return;
    
    try {
      setRepairing(true);
      setProgress(10);
      
      const data = await repairAllIssues(messageIds);
      setProgress(100);
      
      setResult({
        successful: data.results?.successful || 0,
        failed: data.results?.failed || 0,
        total: messageIds.length,
        errors: data.results?.errors
      });
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Error repairing media:', error);
      setResult({
        successful: 0,
        failed: messageIds.length,
        total: messageIds.length,
        errors: [error.message || 'Unknown error occurred']
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
                    {messageIds.length > 0 
                      ? `Repair ${messageIds.length} selected media file${messageIds.length !== 1 ? 's' : ''}`
                      : 'No media files selected for repair'}
                  </p>
                  
                  <div className="space-y-2">
                    <Button 
                      onClick={handleRepairAll} 
                      disabled={messageIds.length === 0 || repairing || isProcessing}
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
                      Standardize All Storage Paths
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
                
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    <p className="font-medium">Errors:</p>
                    <ul className="list-disc pl-5 mt-1">
                      {result.errors.slice(0, 3).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {result.errors.length > 3 && <li>...and {result.errors.length - 3} more errors</li>}
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
