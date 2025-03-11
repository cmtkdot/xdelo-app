
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Wrench } from "lucide-react";
import { MediaRepairDialog } from "@/components/MediaViewer/MediaRepairDialog";

interface MediaFixButtonProps {
  messageIds?: string[];
  onComplete?: () => void;
}

export function MediaFixButton({ messageIds, onComplete }: MediaFixButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleOpenDialog}
        title="Open media repair tool to fix issues with media files"
      >
        <Wrench className="w-4 h-4 mr-2" />
        Repair Media
      </Button>

      <MediaRepairDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            handleComplete();
          }
        }}
      />
    </>
  );
}
