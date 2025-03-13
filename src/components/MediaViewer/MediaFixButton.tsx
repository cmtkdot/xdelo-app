
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { MediaRepairDialog } from "./MediaRepairDialog";
import { Message } from "@/types/MessagesTypes";

interface MediaFixButtonProps {
  messages?: Message[];
  messageIds?: string[];
  onComplete?: () => void;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function MediaFixButton({ 
  messages, 
  messageIds, 
  onComplete,
  variant = "outline",
  size = "sm"
}: MediaFixButtonProps) {
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

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
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
        initialMessageIds={messageIds}
        initialMessages={messages}
        onComplete={handleComplete}
      />
    </>
  );
}
