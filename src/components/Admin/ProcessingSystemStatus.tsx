
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Terminal, RefreshCw, Clock } from 'lucide-react';
import { useProcessingSystem } from '@/hooks/useProcessingSystem';

export function ProcessingSystemStatus() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    getProcessingStats, 
    repairProcessingSystem, 
    repairStuckMessages, 
    isRepairing 
  } = useProcessingSystem();

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProcessingStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching processing system stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Setup a refresh interval
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processing System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <p>Loading status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Processing System Status</span>
          <Button onClick={fetchStats} variant="ghost" size="sm" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Status of the background processing system and message queues
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-col items-center justify-center p-4 text-red-600">
            <AlertTriangle size={24} className="mb-2" />
            <p>Error loading status: {error}</p>
            <Button onClick={fetchStats} variant="outline" className="mt-2">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <StatusCard 
                title="Queue Health"
                status={stats?.queue_health === 'healthy' ? 'healthy' : 'warning'}
                value={stats?.queue_health || 'Unknown'}
                description="Overall queue system status"
              />
              <StatusCard 
                title="Messages in Queue"
                status={stats?.queued_count > 50 ? 'warning' : 'healthy'}
                value={stats?.queued_count || 0}
                description="Waiting to be processed"
              />
              <StatusCard 
                title="Processing Workers"
                status={stats?.active_workers > 0 ? 'healthy' : 'warning'}
                value={stats?.active_workers || 0}
                description={`Last activity: ${stats?.last_worker_activity || 'Unknown'}`}
              />
            </div>
            
            <div className="mt-6 flex flex-wrap gap-3">
              <Button 
                onClick={repairProcessingSystem}
                disabled={isRepairing}
                variant="outline"
              >
                {isRepairing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Terminal className="h-4 w-4 mr-1" />}
                Repair Processing System
              </Button>
              
              <Button 
                onClick={repairStuckMessages}
                disabled={isRepairing}
                variant="outline"
              >
                {isRepairing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Clock className="h-4 w-4 mr-1" />}
                Reset Stuck Messages
              </Button>
            </div>
            
            {stats?.recent_errors && stats.recent_errors.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium mb-2">Recent System Errors:</h4>
                <ul className="space-y-1 text-sm">
                  {stats.recent_errors.map((err: any, idx: number) => (
                    <li key={idx} className="text-red-600 dark:text-red-400">
                      <span className="font-semibold">{err.component}:</span> {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusCard({ 
  title, 
  status, 
  value, 
  description 
}: { 
  title: string; 
  status: 'healthy' | 'warning' | 'error'; 
  value: string | number; 
  description: string;
}) {
  return (
    <div className={`
      p-4 rounded-lg border 
      ${status === 'healthy' ? 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-800' : ''}
      ${status === 'warning' ? 'bg-yellow-50 border-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800' : ''}
      ${status === 'error' ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800' : ''}
    `}>
      <div className="flex justify-between items-start">
        <div>
          <p className={`
            text-sm font-medium
            ${status === 'healthy' ? 'text-green-800 dark:text-green-400' : ''}
            ${status === 'warning' ? 'text-yellow-800 dark:text-yellow-400' : ''}
            ${status === 'error' ? 'text-red-800 dark:text-red-400' : ''}
          `}>
            {title}
          </p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <span className={`
          inline-flex h-3 w-3 rounded-full 
          ${status === 'healthy' ? 'bg-green-500' : ''}
          ${status === 'warning' ? 'bg-yellow-500' : ''}
          ${status === 'error' ? 'bg-red-500' : ''}
        `}></span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
        {description}
      </p>
    </div>
  );
}
