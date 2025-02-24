
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { SyncLogsTable } from "./SyncLogsTable";
import { useQuery } from "@tanstack/react-query";
import { SyncLog } from "./types";

export const SyncCard = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

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

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      // Using a POST request to the edge function instead of direct RPC
      const { data, error } = await supabase
        .from('sync_matches')
        .insert([{ status: 'pending' }])
        .select()
        .single();
      
      if (error) throw error;

      toast({
        title: "Success",
        description: "Sync process has been initiated.",
      });

      // Refresh the logs to show the new sync entries
      await refetchLogs();
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
        <SyncLogsTable logs={syncLogs || []} />
      </div>
    </Card>
  );
};
