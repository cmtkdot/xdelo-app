import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Message } from "@/types/entities/Message";

interface DeleteMessageDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  messageToDelete: Message | null;
  onConfirm: (deleteTelegram: boolean) => Promise<void>;
  isProcessing: boolean;
}

/**
 * Unified delete message dialog component with options to delete from database only or both database and Telegram
 */
export const DeleteMessageDialog: React.FC<DeleteMessageDialogProps> = ({
  isOpen,
  onOpenChange,
  messageToDelete,
  onConfirm,
  isProcessing
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Message</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to delete this message from Telegram as well?
            {messageToDelete?.media_group_id && (
              <p className="mt-2 text-sm text-muted-foreground">
                Note: This will delete all related media in the group.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onConfirm(false)}
            disabled={isProcessing}
          >
            Delete from Database Only
          </AlertDialogAction>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onConfirm(true)}
            disabled={isProcessing}
          >
            Delete from Both
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteMessageDialog;
