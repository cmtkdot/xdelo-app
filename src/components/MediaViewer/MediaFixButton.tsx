
import { Button } from "@/components/ui/button";
import { useMediaReprocessing } from "@/hooks/useMediaReprocessing";
import { Wrench } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";

interface MediaFixButtonProps {
  messageIds?: string[];
  onComplete?: () => void;
}

export function MediaFixButton({ messageIds, onComplete }: MediaFixButtonProps) {
  const { fixContentDisposition, repairStoragePaths, redownloadFromMediaGroup, isProcessing } = useMediaReprocessing();
  const { toast } = useToast();

  const handleFixMediaDisplay = async () => {
    try {
      await fixContentDisposition(messageIds);
      toast({
        title: "Success",
        description: messageIds ? 
          "Fixed content disposition for selected media." : 
          "Started fixing all media files to display inline."
      });
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Failed to fix media display:", error);
    }
  };

  const handleRepairStoragePaths = async () => {
    try {
      await repairStoragePaths(messageIds);
      toast({
        title: "Success",
        description: messageIds ? 
          "Repaired storage paths for selected media." : 
          "Repaired storage paths for all media."
      });
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Failed to repair storage paths:", error);
    }
  };

  const handleRedownloadFromGroup = async () => {
    if (!messageIds || messageIds.length === 0) {
      toast({
        title: "Warning",
        description: "No messages selected for redownload",
        variant: "destructive"
      });
      return;
    }

    try {
      // Invoke the redownload-from-media-group function for each selected message
      const promises = messageIds.map(messageId => 
        redownloadFromMediaGroup(messageId)
      );

      await Promise.all(promises);
      
      toast({
        title: "Success",
        description: "Started redownloading selected media from their groups."
      });
      if (onComplete) onComplete();
    } catch (error) {
      console.error("Failed to redownload media:", error);
    }
  };

  return (
    <div className="flex space-x-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleFixMediaDisplay}
        disabled={isProcessing}
      >
        <Wrench className="w-4 h-4 mr-2" />
        {isProcessing ? "Fixing..." : "Fix Display"}
      </Button>
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleRepairStoragePaths}
        disabled={isProcessing}
      >
        <Wrench className="w-4 h-4 mr-2" />
        {isProcessing ? "Repairing..." : "Fix Storage Paths"}
      </Button>
      
      {messageIds && messageIds.length > 0 && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleRedownloadFromGroup}
          disabled={isProcessing}
        >
          <Wrench className="w-4 h-4 mr-2" />
          {isProcessing ? "Redownloading..." : "Redownload Files"}
        </Button>
      )}
    </div>
  );
}
