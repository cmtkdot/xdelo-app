
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Message } from '@/types/MessagesTypes';

interface MediaRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessages?: Message[];
  initialMessageIds?: string[];
}

export function MediaRepairDialog({ 
  open, 
  onOpenChange 
}: MediaRepairDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Media Repair</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          {/* Will implement repair UI in next iteration */}
          Media repair functionality coming soon
        </div>
      </DialogContent>
    </Dialog>
  );
}
