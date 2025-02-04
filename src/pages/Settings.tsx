import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSyncAllMessages = async () => {
    try {
      setIsSyncing(true);
      
      // Get all completed messages that haven't been synced
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('processing_state', 'completed')
        .is('glide_sync_status', null);
      
      if (fetchError) throw fetchError;

      if (!messages || messages.length === 0) {
        toast({
          title: "No messages to sync",
          description: "All completed messages are already synced.",
        });
        return;
      }

      // Queue messages for sync
      const { error: queueError } = await supabase
        .from('glide_messages_sync_queue')
        .insert(
          messages.map(msg => ({
            message_id: msg.id,
            status: 'pending',
            correlation_id: crypto.randomUUID()
          }))
        );

      if (queueError) throw queueError;

      // Update messages sync status
      const { error: updateError } = await supabase
        .from('messages')
        .update({ glide_sync_status: 'pending' })
        .in('id', messages.map(m => m.id));

      if (updateError) throw updateError;

      toast({
        title: "Sync initiated",
        description: `Queued ${messages.length} messages for sync with Glide.`,
      });

    } catch (error: any) {
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>
      
      <Card className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Account</h3>
            {userEmail && (
              <p className="text-sm text-gray-500">Logged in as {userEmail}</p>
            )}
          </div>
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Glide Sync</h3>
              <p className="text-sm text-gray-500">Sync all completed messages with Glide</p>
            </div>
            <Button 
              onClick={handleSyncAllMessages} 
              disabled={isSyncing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync All Messages'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;