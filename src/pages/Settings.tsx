import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SyncMetrics {
  total_messages: number;
  successful_messages: number;
  failed_messages: number;
  last_sync: string | null;
  pending_items: number;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch sync metrics
  const { data: syncMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['syncMetrics'],
    queryFn: async () => {
      const { data: metrics, error } = await supabase
        .from('glide_messages_sync_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const { count } = await supabase
        .from('glide_messages_sync_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .single();

      return {
        total_messages: metrics?.total_messages || 0,
        successful_messages: metrics?.successful_messages || 0,
        failed_messages: metrics?.failed_messages || 0,
        last_sync: metrics?.completed_at,
        pending_items: count || 0
      } as SyncMetrics;
    },
    refetchInterval: 5000 // Refresh every 5 seconds
  });

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
      
      // Call the function to process Glide sync
      const { error: functionError } = await supabase.functions.invoke('process-glide-sync-queue');
      
      if (functionError) throw functionError;

      toast({
        title: "Sync initiated",
        description: "Messages are being synced with Glide. Check the metrics for details.",
      });

      // Refresh metrics after sync
      await refetchMetrics();

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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Glide Sync</h3>
                <p className="text-sm text-gray-500">Sync messages with Glide</p>
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

            {syncMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-gray-500">Total Messages</h4>
                  <p className="text-2xl font-bold">{syncMetrics.total_messages}</p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-gray-500">Successful</h4>
                  <p className="text-2xl font-bold text-green-600">{syncMetrics.successful_messages}</p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-gray-500">Failed</h4>
                  <p className="text-2xl font-bold text-red-600">{syncMetrics.failed_messages}</p>
                </Card>
                <Card className="p-4">
                  <h4 className="text-sm font-medium text-gray-500">Pending</h4>
                  <p className="text-2xl font-bold text-blue-600">{syncMetrics.pending_items}</p>
                </Card>
              </div>
            )}

            {syncMetrics?.last_sync && (
              <p className="text-sm text-gray-500">
                Last sync: {new Date(syncMetrics.last_sync).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;