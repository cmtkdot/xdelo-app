
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";

interface SyncLog {
  id: string;
  table_name: string;
  record_id: string;
  glide_id: string;
  operation: string;
  status: string;
  created_at: string;
  error_message?: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    };
    getUser();
  }, []);

  const { data: syncLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["sync_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gl_sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as SyncLog[];
    },
  });

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

  const setupTelegramWebhook = async () => {
    try {
      setIsSettingWebhook(true);
      const { error } = await supabase.functions.invoke('setup-telegram-webhook');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Telegram webhook has been set up successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to set up webhook: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.rpc('glapp_manual_sync_products_messages');
      
      if (error) throw error;
      
      if (data && Array.isArray(data) && data.length > 0) {
        const [result] = data;
        if (result.error_message) {
          throw new Error(result.error_message);
        }
        
        toast({
          title: "Success",
          description: `Successfully matched ${result.matched_count} messages with products.`,
        });

        // Refresh the logs to show the new sync logs
        await refetchLogs();
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Error",
        description: `Failed to trigger sync: ${error.message}`,
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
      
      <Card className="p-6 space-y-4">
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
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Telegram Integration</h3>
            <p className="text-sm text-gray-500">Manage Telegram webhook settings</p>
          </div>
          <Button 
            onClick={setupTelegramWebhook} 
            disabled={isSettingWebhook}
          >
            {isSettingWebhook ? "Setting up..." : "Setup Webhook"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Product-Message Sync</h3>
            <p className="text-sm text-gray-500">Manually trigger synchronization between products and messages</p>
          </div>
          <Button 
            onClick={triggerSync} 
            disabled={isSyncing}
          >
            {isSyncing ? "Syncing..." : "Trigger Sync"}
          </Button>
        </div>

        <div className="mt-4">
          <h4 className="text-md font-medium mb-2">Recent Sync Logs</h4>
          <div className="border rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncLogs?.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{log.table_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{log.operation}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        log.status === 'success' ? 'bg-green-100 text-green-800' : 
                        log.status === 'error' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{log.error_message}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
