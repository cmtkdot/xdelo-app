
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { MediaRepairDialog } from "@/components/MediaViewer/MediaRepairDialog";
import { Message } from "@/types";

interface MediaFixButtonProps {
  messageIds?: string[];
  messages?: Message[];
  onComplete?: () => void;
}

export function MediaFixButton({ messageIds, messages, onComplete }: MediaFixButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  // We can't show if there are no messages or messageIds
  if ((!messages || messages.length === 0) && (!messageIds || messageIds.length === 0)) {
    return null;
  }

  // Get the initial message IDs from either source
  const initialMessageIds = messageIds || (messages ? messages.map(m => m.id) : []);

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
        initialMessageIds={initialMessageIds}
        initialMessages={messages}
      />
    </>
  );
}
