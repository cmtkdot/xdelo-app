
import { Button } from "@/components/ui/button";
import { useMediaReprocessing } from "@/hooks/useMediaReprocessing";
import { FileDown, FileUp, Wrench } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";

interface MediaFixButtonProps {
  messageIds?: string[];
  onComplete?: () => void;
}

export function MediaFixButton({ messageIds, onComplete }: MediaFixButtonProps) {
  const { fixContentDisposition, fixMimeTypes, recoverFileMetadata, isProcessing } = useMediaReprocessing();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { toast } = useToast();

  const handleFixMediaDisplay = async () => {
    try {
      await fixContentDisposition(messageIds);
      toast({
        title: "Success",
        description: "Started fixing media files to display inline. This will be applied to new files and redownloaded files."
      });
      onComplete?.();
    } catch (error) {
      console.error("Failed to fix media display:", error);
      toast({
        title: "Error",
        description: "Failed to fix media display. Check console for details.",
        variant: "destructive"
      });
    }
  };

  const handleFixMimeTypes = async () => {
    try {
      await fixMimeTypes();
      toast({
        title: "Success",
        description: "Fixed MIME types for media files with missing or incorrect types."
      });
      onComplete?.();
    } catch (error) {
      console.error("Failed to fix MIME types:", error);
      toast({
        title: "Error",
        description: "Failed to fix MIME types. Check console for details.",
        variant: "destructive"
      });
    }
  };

  const handleRecoverMetadata = async () => {
    try {
      if (!messageIds || messageIds.length === 0) {
        toast({
          title: "Error",
          description: "No message IDs provided for metadata recovery.",
          variant: "destructive"
        });
        return;
      }
      
      await recoverFileMetadata(messageIds);
      toast({
        title: "Success",
        description: `Recovered metadata for ${messageIds.length} files.`
      });
      onComplete?.();
    } catch (error) {
      console.error("Failed to recover metadata:", error);
      toast({
        title: "Error",
        description: "Failed to recover file metadata. Check console for details.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="mb-4 flex space-x-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleFixMediaDisplay}
        disabled={isProcessing}
        title="Fix media files to display in the browser instead of downloading"
      >
        <Wrench className="w-4 h-4 mr-2" />
        {isProcessing ? "Fixing Media..." : "Fix Media Display"}
      </Button>
      
      {messageIds && messageIds.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecoverMetadata}
          disabled={isProcessing}
          title="Recover missing metadata for selected files"
        >
          <FileUp className="w-4 h-4 mr-2" />
          Recover Metadata
        </Button>
      )}
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleFixMimeTypes}
        disabled={isProcessing}
        title="Fix missing or incorrect MIME types"
      >
        <FileDown className="w-4 h-4 mr-2" />
        Fix MIME Types
      </Button>
    </div>
  );
}
