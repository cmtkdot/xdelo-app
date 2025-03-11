
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';

export function MessageHealth() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.rpc('xdelo_get_message_health_stats');
      
      if (error) throw error;
      
      setStats(data);
    } catch (err) {
      console.error('Error fetching message health stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      toast({
        title: "Error loading message health",
        description: err instanceof Error ? err.message : 'Unknown error occurred',
        variant: "destructive"
      });
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
          <CardTitle>Message Processing Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <p>Loading statistics...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message Processing Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-4 text-red-600">
            <AlertTriangle size={24} className="mb-2" />
            <p>Error loading statistics: {error}</p>
            <Button onClick={fetchStats} variant="outline" className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Message Processing Health</span>
          <Button onClick={fetchStats} variant="ghost" size="sm">
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            title="Completed"
            value={stats?.completed_count || 0}
            icon={<CheckCircle className="h-5 w-5 text-green-500" />}
            description="Successfully processed"
          />
          <StatCard 
            title="Pending"
            value={stats?.pending_count || 0}
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            description="Waiting for processing"
          />
          <StatCard 
            title="Errors"
            value={stats?.error_count || 0}
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
            description="Failed processing"
          />
          <StatCard 
            title="Processing"
            value={stats?.processing_count || 0}
            icon={<Activity className="h-5 w-5 text-blue-500" />}
            description="Currently processing"
          />
        </div>
        
        {stats?.recent_errors && stats.recent_errors.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-2">Recent Errors:</h4>
            <ul className="space-y-1 text-sm">
              {stats.recent_errors.map((err: any, idx: number) => (
                <li key={idx} className="text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{err.error_message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon, description }: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  description: string 
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {icon}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        {description}
      </p>
    </div>
  );
}
