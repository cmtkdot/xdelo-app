
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcessingSystemRepair } from '@/hooks/useProcessingSystemRepair';
import { useToast } from '@/hooks/useToast';
import { formatDistanceToNow } from 'date-fns';

export function ProcessingSystemStatus() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { repairProcessingSystem, getProcessingStats, isRepairing } = useProcessingSystemRepair();
  const { toast } = useToast();

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const stats = await getProcessingStats();
      setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const handleRepair = async () => {
    try {
      await repairProcessingSystem();
      // Reload stats after repair
      loadStats();
    } catch (error) {
      console.error('Repair error:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Processing System Status</CardTitle>
        <CardDescription>
          Monitor and repair message processing queue and system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="mb-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="stuck">Stuck Messages ({stats?.stuck_count || 0})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-medium text-orange-700">Stuck Messages</h3>
                  <p className="text-2xl font-bold">{stats?.stuck_count || 0}</p>
                  <p className="text-sm text-gray-500">In "processing" state</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-700">Pending Messages</h3>
                  <p className="text-2xl font-bold">{stats?.pending_count || 0}</p>
                  <p className="text-sm text-gray-500">Awaiting processing</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-medium text-purple-700">Legacy Queue Entries</h3>
                  <p className="text-2xl font-bold">{stats?.queue_count || 0}</p>
                  <p className="text-sm text-gray-500">In old queue table</p>
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="stuck">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 text-left">Message ID</th>
                      <th className="px-4 py-2 text-left">Telegram ID</th>
                      <th className="px-4 py-2 text-left">Has Caption</th>
                      <th className="px-4 py-2 text-left">Started At</th>
                      <th className="px-4 py-2 text-left">Stuck For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.stuck_messages && stats.stuck_messages.length > 0 ? (
                      stats.stuck_messages.map((message: any) => (
                        <tr key={message.id} className="border-t">
                          <td className="px-4 py-2 font-mono text-xs">{message.id}</td>
                          <td className="px-4 py-2">{message.telegram_message_id}</td>
                          <td className="px-4 py-2">{message.caption ? "Yes" : "No"}</td>
                          <td className="px-4 py-2">{new Date(message.processing_started_at).toLocaleString()}</td>
                          <td className="px-4 py-2">
                            {formatDistanceToNow(new Date(message.processing_started_at), { addSuffix: true })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-2 text-center">
                          No stuck messages found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={loadStats} disabled={isLoading}>
          Refresh Status
        </Button>
        <Button onClick={handleRepair} disabled={isRepairing}>
          {isRepairing ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Repairing...
            </>
          ) : (
            "Repair Processing System"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
