
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { MediaRepairDialog } from "./MediaRepairDialog";
import { Message } from "@/types/MessagesTypes";

interface MediaFixButtonProps {
  messages?: Message[];
  messageIds?: string[];
  mediaGroupId?: string;
  onComplete?: () => void;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function MediaFixButton({ 
  messages, 
  messageIds, 
  mediaGroupId,
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

  // Combine message IDs from both props
  const combinedMessageIds = [
    ...(messageIds || []),
    ...(messages?.map(m => m.id) || [])
  ].filter(Boolean);

  // Don't render if there are no messages to repair and no media group ID
  if (combinedMessageIds.length === 0 && !mediaGroupId) {
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
        messageIds={combinedMessageIds}
        messages={messages}
        mediaGroupId={mediaGroupId}
        onComplete={handleComplete}
      />
    </>
  );
}
