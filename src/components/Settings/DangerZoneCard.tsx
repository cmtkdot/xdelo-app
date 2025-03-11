
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
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

export const DangerZoneCard = () => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleClearMessages = async () => {
    try {
      setIsDeleting(true);
      
      // Delete all messages using SQL query
      const { error } = await supabase.rpc('xdelo_clear_all_messages');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "All messages have been deleted successfully",
      });
      
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error('Error clearing messages:', error);
      toast({
        title: "Error",
        description: `Failed to clear messages: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="p-6 border-red-300 bg-red-50 dark:bg-red-950/20">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-red-700 dark:text-red-400">Danger Zone</h3>
          <p className="text-sm text-red-600 dark:text-red-300">
            These actions are destructive and cannot be undone. Please be careful.
          </p>
        </div>
        
        <div className="pt-2 border-t border-red-200 dark:border-red-700">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Clear All Messages</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Delete all messages from the database. This action cannot be undone.
              </p>
            </div>
            <Button 
              variant="destructive"
              onClick={() => setIsConfirmOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Clear Messages"}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete ALL messages
              from your database, including all media files, captions, and analyzed content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleClearMessages}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
