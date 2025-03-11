
import { Button } from "@/components/ui/button";
import { useMediaReprocessing } from "@/hooks/useMediaReprocessing";
import { FileDown } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";

interface MediaFixButtonProps {
  messageIds?: string[];
  onComplete?: () => void;
}

export function MediaFixButton({ messageIds, onComplete }: MediaFixButtonProps) {
  const { redownloadFromMediaGroup, isProcessing } = useMediaReprocessing();
  const { toast } = useToast();

  const handleRedownloadFiles = async () => {
    if (!messageIds?.length) {
      toast({
        title: "Error",
        description: "No messages selected for redownloading",
        variant: "destructive"
      });
      return;
    }

    try {
      // Process each message ID for redownload
      const promises = messageIds.map(messageId => 
        redownloadFromMediaGroup(messageId)
      );
      
      await Promise.all(promises);
      
      toast({
        title: "Success",
        description: `Started redownloading ${messageIds.length} media files`,
      });
      
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Failed to redownload media files:", error);
      toast({
        title: "Error",
        description: "Failed to redownload media files. Check console for details.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="mb-4 flex space-x-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleRedownloadFiles}
        disabled={isProcessing}
        title="Redownload media files with proper MIME types and storage paths"
      >
        <FileDown className="w-4 h-4 mr-2" />
        {isProcessing ? "Processing..." : "Redownload Media"}
      </Button>
    </div>
  );
}
