
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { SyncLogsTable } from "./SyncLogsTable";
import { useQuery } from "@tanstack/react-query";
import { SyncLog } from "./types";
import { logEvent, LogEventType } from "@/lib/logUtils";

export const SyncCard = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const { data: syncLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["sync_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_audit_logs")
        .select("*")
        .in('event_type', [
          LogEventType.SYNC_STARTED, 
          LogEventType.SYNC_COMPLETED, 
          LogEventType.SYNC_FAILED,
          LogEventType.SYNC_PRODUCTS
        ])
        .order("event_timestamp", { ascending: false })
        .limit(20);

      if (error) throw error;
      
      // Transform to expected format
      const transformedData = data.map(log => ({
        id: log.id,
        table_name: log.metadata?.table_name || 'system',
        operation: log.event_type,
        status: log.event_type === LogEventType.SYNC_COMPLETED ? 'success' : 
                log.event_type === LogEventType.SYNC_FAILED ? 'error' : 'pending',
        error_message: log.error_message,
        created_at: log.event_timestamp
      }));
      
      return transformedData as SyncLog[];
    },
  });

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      
      // Log sync operation start
      const syncId = `sync_${Date.now()}`;
      await logEvent(
        LogEventType.SYNC_STARTED,
        syncId,
        {
          initiated_by: 'user',
          trigger_source: 'manual'
        }
      );
      
      // Using a POST request to the edge function instead of direct RPC
      const { data, error } = await supabase
        .from('sync_matches')
        .insert([{ status: 'pending' }])
        .select()
        .single();
      
      if (error) throw error;

      // Log sync operation complete
      await logEvent(
        LogEventType.SYNC_COMPLETED,
        syncId,
        {
          status: 'success',
          sync_match_id: data?.id
        }
      );

      toast({
        title: "Success",
        description: "Sync process has been initiated.",
      });

      // Refresh the logs to show the new sync entries
      await refetchLogs();
    } catch (error: any) {
      console.error('Sync error:', error);
      
      // Log sync operation error
      await logEvent(
        LogEventType.SYNC_FAILED,
        `sync_${Date.now()}`,
        {
          error: error.message
        },
        {
          error_message: error.message
        }
      );
      
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
