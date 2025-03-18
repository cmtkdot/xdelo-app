
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { MediaRepairDialog } from "./MediaRepairDialog";
import { Message } from "@/types/MessagesTypes";
import { useMediaUtils } from "@/hooks/useMediaUtils";

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
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  
  const { repairMediaBatch } = useMediaUtils();

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(undefined);
    
    try {
      // Combine message IDs from both props
      const combinedMessageIds = [
        ...(messageIds || []),
        ...(messages?.map(m => m.id) || [])
      ].filter(Boolean);
      
      const result = await repairMediaBatch(combinedMessageIds);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to repair media');
      }
      
      setOpen(false);
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if there are no messages to repair and no media group ID
  if ((messageIds?.length === 0 && !messages?.length) && !mediaGroupId) {
    return null;
  }

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={() => setOpen(true)}
        title="Open media repair tool to fix issues with media files"
      >
        <Wrench className="w-4 h-4 mr-2" />
        Repair Media
      </Button>

      <MediaRepairDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        isLoading={isLoading}
        error={error}
      />
    </>
  );
}
