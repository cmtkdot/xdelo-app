import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SyncMetrics {
  total_messages: number;
  successful_messages: number;
  failed_messages: number;
  started_at: string;
  completed_at: string;
}

interface SyncError {
  message_id: string;
  error: string;
  timestamp: string;
}

const GlideSync = () => {
  const [metrics, setMetrics] = useState<SyncMetrics | null>(null);
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('glide_messages_sync_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sync metrics",
        variant: "destructive",
      });
    }
  };

  const fetchErrors = async () => {
    try {
      const { data, error } = await supabase
        .from('glide_messages_sync_queue')
        .select('*')
        .eq('status', 'error')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setErrors(data || []);
    } catch (error) {
      console.error('Error fetching sync errors:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sync errors",
        variant: "destructive",
      });
    }
  };

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      const { error } = await supabase.functions.invoke('sync-messages-to-glide');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Sync process started successfully",
      });
      
      // Refresh metrics after a short delay
      setTimeout(fetchMetrics, 2000);
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: "Error",
        description: "Failed to start sync process",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchMetrics(), fetchErrors()])
      .finally(() => setIsLoading(false));

    // Set up polling for updates
    const interval = setInterval(() => {
      fetchMetrics();
      fetchErrors();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Glide Sync Management</h1>
        <Button 
          onClick={triggerSync} 
          disabled={isSyncing}
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            'Trigger Sync'
          )}
        </Button>
      </div>

      {/* Metrics Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Total Messages</h3>
          <p className="text-2xl">{metrics?.total_messages || 0}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Successful</h3>
          <p className="text-2xl text-green-600">{metrics?.successful_messages || 0}</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Failed</h3>
          <p className="text-2xl text-red-600">{metrics?.failed_messages || 0}</p>
        </Card>
      </div>

      {/* Last Sync Status */}
      {metrics && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Last Sync</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Started</p>
              <p>{new Date(metrics.started_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p>{metrics.completed_at ? new Date(metrics.completed_at).toLocaleString() : 'In Progress'}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Sync Errors</h2>
        {errors.length === 0 ? (
          <Card className="p-4">
            <div className="flex items-center text-green-600">
              <CheckCircle2 className="mr-2" />
              No sync errors found
            </div>
          </Card>
        ) : (
          errors.map((error) => (
            <Alert variant="destructive" key={error.message_id}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error.error}
                <div className="text-xs mt-1">
                  Message ID: {error.message_id}
                  <br />
                  Time: {new Date(error.timestamp).toLocaleString()}
                </div>
              </AlertDescription>
            </Alert>
          ))
        )}
      </div>
    </div>
  );
};

export default GlideSync;