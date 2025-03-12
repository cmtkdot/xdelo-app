
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function DangerZoneCard() {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleClearAllMessages = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_clear_all_messages');
      
      if (error) {
        throw error;
      }
      
      toast.success('All messages have been successfully cleared');
      console.log('Clear messages result:', data);
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast.error('Failed to clear messages: ' + (error.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-red-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-red-500">Danger Zone</CardTitle>
        <CardDescription>
          These actions are destructive and cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Clear All Messages</p>
          <p className="text-sm text-muted-foreground">
            This will delete all messages from the database. This action cannot be undone.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                "Clear All Messages"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all
                messages from the database and remove all related data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleClearAllMessages}
                className="bg-red-500 hover:bg-red-600"
              >
                Yes, clear all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
